# Physics Simulation Type Patterns

This document defines a classification framework for physics simulations based on their **underlying physical mechanism**, rather than topic names. Each type represents a **reusable simulation template** that enables scalable development of multiple textbook-based simulations.

---

## 1. Force Interaction Type

### Why this type exists
This type groups simulations where an object’s behavior is determined by the **balance of forces acting on it**. In all cases, the key question is whether forces cancel out or produce acceleration.

### What stays the same (reusable)
- Core calculation: identify forces → compute net force → apply Newton’s Second Law (F = ma)
- State handling for rest vs motion
- Shared UI structure for force sliders and live outputs
- Data logging of force changes and motion transitions

### What changes per example
- Types of forces involved (friction, tension, drag, applied force)
- Direction and magnitude of forces
- Visual context (block, rope, object in air)

### Scalability rationale
By isolating force-interaction simulations, a single engine can power many scenarios without rewriting force-resolution logic.

**Scalability example:**  
First simulator ≈ 4 hours  
Each additional variant ≈ 20–30 minutes

---

## 2. Field-Based Simulation Type

### Why this type exists
This type covers simulations where forces arise from a **field that varies with position**, rather than direct contact. The focus is understanding how field strength changes in space.

### What stays the same (reusable)
- Core calculation: field strength as a function of position → derive force
- Consistent UI for position-based parameters
- Field visualization patterns
- Logging of position and field strength changes

### What changes per example
- Type of field (gravitational, electric, magnetic)
- Mathematical relationship (e.g. inverse-square)
- Contextual visualization (Earth, Moon, planetary systems)

### Scalability rationale
Separating field-based simulations allows one engine to support many gravity-related demonstrations with consistent interaction patterns.

**Scalability example:**  
One engine supports gravity vs distance, gravity on different planets, and orbit-related concepts.

---

## 3. Force–Property Relation Type

### Why this type exists
This type includes simulations where a physical quantity is determined directly by a **formula**, without time evolution or motion. The learning goal is understanding dependency between variables.

### What stays the same (reusable)
- Direct formula evaluation
- Immediate output updates on parameter change
- Simple slider-based UI
- Logging of parameter manipulation

### What changes per example
- Variables involved in the relationship
- Visualization style (scale, gauge, numeric comparison)

### Scalability rationale
Keeping these simulations separate avoids unnecessary animation loops and keeps concept demonstrations simple and focused.

**Scalability example:**  
One template supports mass–weight, density calculations, and similar proportional relationships.

---

## 4. Pressure / Ratio-Based Simulation Type

### Why this type exists
This type captures simulations where understanding comes from **comparing ratios**, such as force per unit area, rather than motion or force balance.

### What stays the same (reusable)
- Ratio-based calculations (e.g. pressure = force / area)
- Static or quasi-static visualizations
- Comparison-focused UI
- Logging of variable adjustments

### What changes per example
- Physical context (solid pressure, liquid pressure)
- Units and diagram representation

### Scalability rationale
Grouping ratio-based simulations prevents mixing them with motion-based engines and improves conceptual clarity.

**Scalability example:**  
One template supports solid pressure, liquid pressure, and hydraulic system simulations.

---

## Summary

Classifying simulations by **physical mechanism** enables:
- Reuse of calculation engines
- Consistent user interaction
- Faster development of new simulations
- Clearer learning outcomes

This framework forms the foundation for a scalable physics simulation system.
