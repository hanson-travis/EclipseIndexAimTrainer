# Test Plan: Eclipse Index Trainer

## Core Logic Validation (EI -> Angle)
Verify the following mappings in the "Info" section of the app:
- [ ] **EI 0**: Should result in exactly **0°**.
- [ ] **EI 2**: Should result in approximately **14.5°**.
- [ ] **EI 4**: Should result in exactly **30°** (Half-ball hit).
- [ ] **EI 6**: Should result in approximately **48.6°**.
- [ ] **EI 7**: Should result in approximately **61.0°**.
- [ ] **EI 8**: Should result in **90°**.

## Functional Checks
- [ ] **New Round**: Clicking "Next Shot" or "Reset" generates a new target angle.
- [ ] **Interaction**: Dragging in the Shooter View snaps the OB to the 6 allowed EI levels.
- [ ] **Scoring**: Getting the EI and direction (left/right) correct adds 10 points.
- [ ] **Feedback**:
    - [ ] "Too thin" if selected EI > target EI.
    - [ ] "Too full" if selected EI < target EI.
    - [ ] "Wrong side" if direction is inverted.

## Visual Fidelity
- [ ] Plan View should update correctly when the target changes.
- [ ] Shooter View should correctly represent the overlap of balls based on the selected EI.
- [ ] UI is responsive on mobile and desktop.
