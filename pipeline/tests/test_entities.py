from mhdebt.entities import is_statutory_agent, names_match


def test_exact_and_suffix_match():
    assert names_match("Paradise Partners LLC", "Paradise Partners")
    assert names_match("Paradise Partners LLC", "paradise partners, llc")


def test_holdings_alone_does_not_match():
    assert not names_match("Desert Holdings LLC", "Saguaro Holdings LLC")


def test_person_tokens_do_not_partial_match():
    assert not names_match("Vara", "Alvarado")


def test_statutory_agents_are_excluded():
    assert is_statutory_agent("CT Corporation System")
    assert not names_match("CT Corporation System", "CT Corporation System")
