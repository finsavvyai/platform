import React from 'react'
import { Route } from 'react-router-dom'
import {
  CaseManagement, CaseDetail, RiskAssessment, UBOChain,
  EDDWorkflow, TransactionMonitoring, AdverseMedia, PEPScreening,
  SARForm, ComplianceReport, CryptoScreeningPage, TxnScreeningPage,
  VesselScreening,
} from './lazyCompliance'

type PWrapper = ({ children }: { children: React.ReactNode }) => JSX.Element

export function complianceRoutes(P: PWrapper) {
  return (
    <>
      <Route path="/compliance/cases" element={<P><CaseManagement /></P>} />
      <Route path="/compliance/cases/:id" element={<P><CaseDetail /></P>} />
      <Route path="/compliance/risk" element={<P><RiskAssessment /></P>} />
      <Route path="/compliance/ubo/:id" element={<P><UBOChain /></P>} />
      <Route path="/compliance/edd/:id" element={<P><EDDWorkflow /></P>} />
      <Route path="/compliance/txn" element={<P><TransactionMonitoring /></P>} />
      <Route path="/compliance/media" element={<P><AdverseMedia /></P>} />
      <Route path="/compliance/pep" element={<P><PEPScreening /></P>} />
      <Route path="/compliance/sar" element={<P><SARForm /></P>} />
      <Route path="/compliance/report" element={<P><ComplianceReport /></P>} />
      <Route path="/compliance/crypto" element={<P><CryptoScreeningPage /></P>} />
      <Route path="/compliance/txn-screen" element={<P><TxnScreeningPage /></P>} />
      <Route path="/compliance/vessel" element={<P><VesselScreening /></P>} />
    </>
  )
}
