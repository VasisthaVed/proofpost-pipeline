# ProofPost Operator Debug Mode

/debug-runtime

Read first:

* docs/OPERATOR_TESTING_GUIDE.md
* docs/governance/constitution.md

Purpose:
Explain the current runtime state in simple operational language.

The AI must:

* explain what subsystem is running
* explain what each endpoint does
* explain what logs mean
* explain what failed
* explain what success looks like

The AI must NOT:

* redesign architecture
* add features
* refactor unrelated code
* overwhelm with theory

When operator provides:

* terminal logs
* Swagger responses
* API errors

The AI should explain:

1. what happened
2. why it happened
3. whether it is dangerous
4. next exact step to test

Always assume:
operator is learning runtime flow in real-time.

Focus:
operational clarity over technical jargon.
