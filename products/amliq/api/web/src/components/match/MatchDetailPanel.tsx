import React from 'react';
import { MatchDetailHeader } from './MatchDetailHeader';
import { BioSection } from './MatchBio';
import { NamesSection, IdentifiersSection } from './MatchSections';
import { SanctionsSection } from './MatchSanctions';
import { ContactSection } from './MatchContact';
import { LayersSection } from './MatchLayers';

export interface MatchData {
  entity_id: string;
  entity_name: string;
  list_id: string;
  confidence: number;
  disposition: string;
  type?: string;
  date_of_birth?: string;
  given_name?: string;
  family_name?: string;
  nationalities?: string[];
  addresses?: string[];
  aliases?: string[];
  identifiers?: { type: string; value: string; country: string }[];
  dataset?: string;
  schemaType?: string;
  firstSeen?: string;
  lastSeen?: string;
  lastChange?: string;
  listingDate?: string;
  birthPlace?: string;
  birthCountry?: string;
  sourceUrl?: string;
  gender?: string;
  position?: string;
  pepTier?: string;
  emails?: string[];
  phones?: string[];
  websites?: string[];
  programs?: string[];
  sanctions?: string | object[];
  remarks?: string;
  layers?: { layer: string; score: number; algorithm: string; matched: string }[];
  explanation?: string;
  metadata?: Record<string, unknown>;
}

interface Props {
  match: MatchData;
  onClose?: () => void;
}

export const MatchDetailPanel: React.FC<Props> = ({ match, onClose }) => (
  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200
    dark:border-gray-700 overflow-hidden w-full">
    <MatchDetailHeader match={match} onClose={onClose} />
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      <BioSection match={match} />
      <NamesSection aliases={match.aliases} givenName={match.given_name}
        familyName={match.family_name} />
      <IdentifiersSection identifiers={match.identifiers} />
      <SanctionsSection sanctions={match.sanctions} programs={match.programs}
        remarks={match.remarks} sourceUrl={match.sourceUrl} />
      <ContactSection emails={match.emails} phones={match.phones}
        websites={match.websites} addresses={match.addresses} />
      <LayersSection layers={match.layers} explanation={match.explanation} />
    </div>
  </div>
);

export default MatchDetailPanel;
