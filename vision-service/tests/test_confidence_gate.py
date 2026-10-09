from app.inference import apply_confidence_gate
from app.schemas import SeverityJson


def _r(sev, conf, feats=("smoke",)):
    return SeverityJson(severity=sev, severity_confidence=conf, severity_index=3, key_features=list(feats))


def test_low_confidence_flagged():
    r = apply_confidence_gate(_r("high", 0.353, ("actual_flames", "burn_scars")))
    assert r.needs_review and r.key_features == [] and "human review" in r.review_reason


def test_confident_fire_untouched():
    r = apply_confidence_gate(_r("high", 0.803))
    assert not r.needs_review and r.key_features == ["smoke"]


def test_none_never_flagged():
    assert not apply_confidence_gate(_r("none", 0.2, ())).needs_review
