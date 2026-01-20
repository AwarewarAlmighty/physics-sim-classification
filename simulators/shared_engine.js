/*
  SharedPhysicsEngine
  - One runtime loop for all simulators
  - Uniform UI binding (sliders, output cards, canvas render)
  - Event logging for learning measurement
*/
(function(){
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => Date.now();

  function fmtNumber(v, decimals){
    if(!isFinite(v)) return "—";
    const d = (decimals ?? 2);
    return Number(v).toFixed(d);
  }

  function createEl(tag, attrs={}, children=[]){
    const el = document.createElement(tag);
    for(const [k,val] of Object.entries(attrs)){
      if(k === "class") el.className = val;
      else if(k === "text") el.textContent = val;
      else if(k.startsWith("on") && typeof val === "function") el.addEventListener(k.slice(2), val);
      else el.setAttribute(k, val);
    }
    for(const c of children) el.appendChild(c);
    return el;
  }

  class DataLogger{
    constructor(simId){
      this.simId = simId;
      this.events = [];
      this.sessionStart = now();
      this.lastActiveTs = this.sessionStart;
      this.playTimeMs = 0;
      this.isPlaying = false;
      this.playStartTs = null;
    }
    _push(type, payload){
      const e = { ts: now(), simId: this.simId, type, payload };
      this.events.push(e);
      this.lastActiveTs = e.ts;
    }
    startSession(meta){
      this._push("session_start", meta || {});
    }
    endSession(meta){
      if(this.isPlaying) this.pause();
      this._push("session_end", meta || {});
    }
    play(){
      if(this.isPlaying) return;
      this.isPlaying = true;
      this.playStartTs = now();
      this._push("play", {});
    }
    pause(){
      if(!this.isPlaying) return;
      const t = now();
      this.playTimeMs += Math.max(0, t - this.playStartTs);
      this.isPlaying = false;
      this.playStartTs = null;
      this._push("pause", {});
    }
    reset(){
      this._push("reset", {});
    }
    paramChange(name, oldValue, newValue){
      this._push("param_change", { name, oldValue, newValue });
    }
    observationNote(noteKey){
      this._push("observation_note", { noteKey });
    }
    hintShown(hintKey){
      this._push("hint_shown", { hintKey });
    }
    exportJSON(){
      const summary = {
        simId: this.simId,
        sessionStart: this.sessionStart,
        sessionEnd: now(),
        playTimeMs: this.playTimeMs,
        events: this.events
      };
      return JSON.stringify(summary, null, 2);
    }
  }

  class SharedPhysicsEngine{
    constructor(simulator, ui){
      this.sim = simulator;
      this.ui = ui;
      this.logger = new DataLogger(simulator.id);
      this.state = null;
      this.params = {};
      this.outputs = {};
      this.running = false;
      this._raf = null;
      this._lastFrame = null;

      this._recentParamChanges = []; // for lightweight exploration pattern detection
      this._hintCooldownUntil = 0;
    }

    init(){
      // init params with defaults
      this.params = {};
      for(const p of this.sim.params){
        this.params[p.key] = p.default;
      }
      this.state = this.sim.initState ? this.sim.initState(this.params) : {};
      this.logger.startSession({ simulatorName: this.sim.name });

      this._buildUI();
      this._recompute(0);
      this._render();

      this._wireButtons();
      this._wireKeyboardShortcuts();
      this._resizeCanvasToCSSPixels();
      window.addEventListener("resize", () => this._resizeCanvasToCSSPixels());
    }

    destroy(){
      this.pause();
      this.logger.endSession({});
    }

    play(){
      if(this.running) return;
      this.running = true;
      this._lastFrame = null;
      this.logger.play();
      this._tick();
      this._setStatus("Playing");
    }

    pause(){
      if(!this.running) return;
      this.running = false;
      if(this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
      this._lastFrame = null;
      this.logger.pause();
      this._setStatus("Paused");
    }

    reset(){
      this.pause();
      // restore params to defaults
      for(const p of this.sim.params){
        this.params[p.key] = p.default;
        const input = this.ui.sliderInputs.get(p.key);
        const valSpan = this.ui.sliderValues.get(p.key);
        if(input) input.value = String(p.default);
        if(valSpan) valSpan.textContent = this._formatParamValue(p, p.default);
      }
      this.state = this.sim.initState ? this.sim.initState(this.params) : {};
      this.logger.reset();
      this._recentParamChanges = [];
      this._recompute(0);
      this._render();
      this._setStatus("Reset");
    }

    setParam(key, value){
      const p = this.sim.params.find(x => x.key === key);
      if(!p) return;
      const oldV = this.params[key];
      const v = clamp(value, p.min, p.max);
      this.params[key] = v;
      this.logger.paramChange(key, oldV, v);
      this._recentParamChanges.push({ ts: now(), key, oldV, v });
      // keep last 20
      if(this._recentParamChanges.length > 20) this._recentParamChanges.shift();

      this._maybeHint();
      this._recompute(0);
      this._render();
    }

    logObservation(noteKey){
      this.logger.observationNote(noteKey);
      this._toast("Observation logged: " + noteKey);
    }

    downloadLog(){
      const blob = new Blob([this.logger.exportJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${this.sim.id}_event_log.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    _tick(){
      if(!this.running) return;
      this._raf = requestAnimationFrame((t)=>{
        if(this._lastFrame == null) this._lastFrame = t;
        let dt = (t - this._lastFrame) / 1000;
        this._lastFrame = t;
        // clamp dt to avoid giant steps when tab switches
        dt = Math.max(0, Math.min(dt, 0.05));

        this._recompute(dt);
        this._render();

        this._tick();
      });
    }

    _recompute(dt){
      // unify model: sim.step(state, params, dt) -> { state, outputs }
      const res = this.sim.step(this.state, this.params, dt);
      if(res && res.state) this.state = res.state;
      if(res && res.outputs) this.outputs = res.outputs;

      // update output cards
      for(const out of this.sim.outputs){
        const el = this.ui.outputValues.get(out.key);
        if(!el) continue;
        const v = this.outputs[out.key];
        el.innerHTML = `${fmtNumber(v, out.decimals)} <small>${out.unit || ""}</small>`;
      }
    }

    _render(){
      const ctx = this.ui.ctx;
      const c = this.ui.canvas;
      ctx.clearRect(0,0,c.width,c.height);
      this.sim.render(ctx, c, this.state, this.params, this.outputs);
    }

    _buildUI(){
      // sliders
      this.ui.sliderInputs = new Map();
      this.ui.sliderValues = new Map();
      this.ui.outputValues = new Map();

      this.ui.simTitle.textContent = this.sim.name;

      // clear containers
      this.ui.sliderContainer.innerHTML = "";
      this.ui.outputContainer.innerHTML = "";

      for(const p of this.sim.params){
        const valSpan = createEl("span", { class:"val", text: this._formatParamValue(p, this.params[p.key]) });
        const rowTop = createEl("div", { class:"sliderTop" }, [
          createEl("div", { text: p.label }),
          createEl("div", { class:"unit", text: p.unit ? p.unit : "" }),
          valSpan
        ]);
        const input = createEl("input", {
          type:"range",
          min:String(p.min),
          max:String(p.max),
          step:String(p.step ?? 0.1),
          value:String(this.params[p.key]),
          oninput: (e)=>{
            const v = parseFloat(e.target.value);
            valSpan.textContent = this._formatParamValue(p, v);
            this.setParam(p.key, v);
          }
        });
        const row = createEl("div", { class:"sliderRow" }, [rowTop, input]);

        this.ui.sliderContainer.appendChild(row);
        this.ui.sliderInputs.set(p.key, input);
        this.ui.sliderValues.set(p.key, valSpan);
      }

      // outputs
      for(const out of this.sim.outputs){
        const value = createEl("div", { class:"outValue" });
        const card = createEl("div", { class:"outCard" }, [
          createEl("div", { class:"outLabel", text: out.label }),
          value
        ]);
        this.ui.outputContainer.appendChild(card);
        this.ui.outputValues.set(out.key, value);
      }

      // hint text
      this._setHint(this.sim.hintText || "Adjust one variable at a time to discover patterns.");
      this._setStatus("Ready");
    }

    _wireButtons(){
      this.ui.btnPlay.addEventListener("click", ()=> this.play());
      this.ui.btnPause.addEventListener("click", ()=> this.pause());
      this.ui.btnReset.addEventListener("click", ()=> this.reset());
      this.ui.btnLog.addEventListener("click", ()=> {
        const note = prompt("What pattern did you observe? (short keyword)");
        if(note && note.trim().length){
          this.logObservation(note.trim());
        }
      });
      this.ui.btnDownload.addEventListener("click", ()=> this.downloadLog());
    }

    _wireKeyboardShortcuts(){
      window.addEventListener("keydown", (e)=>{
        if(e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
        if(e.code === "Space"){
          e.preventDefault();
          this.running ? this.pause() : this.play();
        }
        if(e.key.toLowerCase() === "r"){
          this.reset();
        }
      });
    }

    _resizeCanvasToCSSPixels(){
      const canvas = this.ui.canvas;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      this.ui.ctx.setTransform(dpr,0,0,dpr,0,0);
      this._render();
    }

    _formatParamValue(p, v){
      const decimals = p.decimals ?? (p.step && p.step < 1 ? 1 : 0);
      return `${fmtNumber(v, decimals)}`;
    }

    _maybeHint(){
      const t = now();
      if(t < this._hintCooldownUntil) return;

      // Analyze last ~10 changes over last 20s
      const recent = this._recentParamChanges.filter(x => (t - x.ts) < 20000).slice(-10);
      if(recent.length < 8) return;

      const uniqueKeys = new Set(recent.map(x=>x.key));
      const bigJumps = recent.filter(x => Math.abs(x.v - x.oldV) > 0.45 * (this._paramRange(x.key))).length;

      // Random-ish if many params changed and many big jumps
      if(uniqueKeys.size >= 3 && bigJumps >= 4){
        const hintKey = "systematic_exploration";
        this.logger.hintShown(hintKey);
        this._toast("Hint: try changing one slider at a time to spot the relationship.");
        this._setHint("Hint: keep two sliders fixed, and move only one slowly. Then switch.");
        this._hintCooldownUntil = t + 25000;
      }
    }

    _paramRange(key){
      const p = this.sim.params.find(x=>x.key === key);
      return p ? (p.max - p.min) : 1;
    }

    _setHint(text){
      this.ui.hint.innerHTML = `<strong>What to try:</strong> ${text}`;
    }

    _setStatus(text){
      this.ui.status.textContent = text;
    }

    _toast(text){
      this.ui.toast.textContent = text;
      this.ui.toast.style.opacity = "1";
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(()=>{ this.ui.toast.style.opacity="0.85"; }, 2500);
    }
  }

  window.SharedPhysicsEngine = { SharedPhysicsEngine };
})();
