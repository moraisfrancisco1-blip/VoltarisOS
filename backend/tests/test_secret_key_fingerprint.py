from backend.security import SECRET_KEY, secret_key_fingerprint


def test_fingerprint_is_short_stable_and_key_dependent():
    fp = secret_key_fingerprint("key-a")
    assert len(fp) == 8 and fp == secret_key_fingerprint("key-a")
    assert fp != secret_key_fingerprint("key-b")


def test_fingerprint_does_not_contain_the_key():
    assert SECRET_KEY not in secret_key_fingerprint(SECRET_KEY)
