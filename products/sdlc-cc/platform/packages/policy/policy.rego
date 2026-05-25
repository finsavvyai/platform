package sdlc.policy
default allow = false

allowed = {
  "risk_analysis": {"transactions.amount","transactions.country","customers.segment"}
}[input.purpose]

allow {
  input.action == "rag.retrieve"
  every f in input.fields { f in allowed }
}
