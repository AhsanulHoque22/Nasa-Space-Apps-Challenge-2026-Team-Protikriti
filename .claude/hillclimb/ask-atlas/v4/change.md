Free round (no Sonnet judge; Haiku answers + code checks, graded by hand). Partial run: the 27 v3 failures plus every 4th v3 pass (54 cases), $0.031.

- Number check bug: numbers written after an acronym in the notes ("LED 1.66", "GM 42,828.37") were never added to the known numbers, so quoting them was flagged as invented (c048, c084). Known numbers now come from every number in the facts, question and notes; the name skips apply only to the answer.
- c060 ground truth was wrong: the notes do say the game storm lasts 100 sols. Expectation changed to explain.
- Rules: no closing "the data doesn't say" line about something not asked (19 of 54 answers in v3 did this, often wrongly); keep a note's meaning instead of rephrasing it into another claim; never say what goes on which lander even when the notes list it; off-topic suggestions without numbers.

Hand grade: 21 of the 27 v3 failures now pass; about 2 of the 27 v3 passes looked worse (c003, c042).
