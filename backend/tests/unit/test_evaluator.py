"""
Unit test for Biomechanical Form Quality Evaluator.
"""
from app.ml_serving.schemas import FormQualityInferenceRequest, RepTelemetryInput
from app.ml_serving.evaluator import (
    calculate_rom_adequacy,
    calculate_velocity_smoothness,
    calculate_fatigue_decay,
    evaluate_form_quality,
)

def test_evaluator():
    reps = [
        RepTelemetryInput(rep_no=1, duration_ms=2800.0, rom_deg=36.0, form_score=95.0, errors=[]),
        RepTelemetryInput(rep_no=2, duration_ms=2900.0, rom_deg=35.0, form_score=94.0, errors=[]),
        RepTelemetryInput(rep_no=3, duration_ms=3000.0, rom_deg=33.0, form_score=90.0, errors=["too_fast"]),
        RepTelemetryInput(rep_no=4, duration_ms=3200.0, rom_deg=30.0, form_score=85.0, errors=["knee_valgus"]),
    ]

    rom_score = calculate_rom_adequacy(reps, target_rom=35.0, baseline_rom=28.0)
    assert rom_score > 80.0, f"Expected >80, got {rom_score}"

    smoothness = calculate_velocity_smoothness(reps)
    assert smoothness > 70.0, f"Expected >70, got {smoothness}"

    decay = calculate_fatigue_decay(reps)
    assert decay > 0.0, f"Expected positive decay, got {decay}"

    req = FormQualityInferenceRequest(
        exercise_id=1,
        exercise_name="Heel Raise",
        side="right",
        target_rom_deg=35.0,
        baseline_rom_deg=28.0,
        reps=reps,
    )
    res = evaluate_form_quality(req)
    assert res.overall_quality_score > 0
    assert res.quality_tier in ["excellent", "satisfactory", "needs_attention"]
    assert "knee_valgus" in res.biomechanical_breakdown.detected_compensations
    assert len(res.clinical_recommendations) > 0

    # Router function tests (coroutine direct dispatch)
    from app.ml_serving.router import ml_service_status, predict_form_quality_inference
    c_status = ml_service_status()
    try:
        c_status.send(None)
    except StopIteration as e:
        st = e.value
    assert st["status"] == "online"
    assert "loaded_models" in st

    c_inf = predict_form_quality_inference(req)
    try:
        c_inf.send(None)
    except StopIteration as e:
        inf_res = e.value
    assert inf_res.overall_quality_score == res.overall_quality_score
    assert inf_res.quality_tier == res.quality_tier

    print("ALL EVALUATOR & ML ROUTER TESTS PASSED!")

if __name__ == "__main__":
    test_evaluator()
