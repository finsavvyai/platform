import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EntityHeader } from '../components/entity/EntityHeader';
import { EntityNames } from '../components/entity/EntityNames';
import { EntityIdentifiers } from '../components/entity/EntityIdentifiers';
import { EntitySanctions } from '../components/entity/EntitySanctions';
import { EntityContact } from '../components/entity/EntityContact';
import { EntityExtended } from '../components/entity/EntityExtended';
import { LoadingState, ErrorState } from './EntityStates';

interface EntityData {
  id: string;
  type: string;
  primary_name: string;
  names: { full: string; given: string; family: string; original_script: string }[];
  identifiers: { type: string; value: string; country: string }[];
  addresses: string[];
  nationalities: string[];
  list_id: string;
  date_of_birth?: string;
  emails?: string[];
  phones?: string[];
  websites?: string[];
  sanctions?: { authority?: string; program?: string; reason?: string }[];
  source_url?: string;
  birth_place?: string;
  birth_country?: string;
  dataset?: string;
  schema_type?: string;
  listing_date?: string;
  first_seen?: string;
  last_seen?: string;
  last_change?: string;
  programs?: string[];
  remarks?: string;
  gender?: string;
  position?: string;
  pep_tier?: string;
  extended_data?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

export default function EntityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<EntityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/v1/entities/${encodeURIComponent(id)}`)
      .then((r) => { if (!r.ok) throw new Error('Not found'); return r.json(); })
      .then((json) => setEntity(json.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState />;
  if (error || !entity) return <ErrorState message={error} onBack={() => navigate(-1)} />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <button onClick={() => navigate(-1)} aria-label="Go back"
        className="text-sm text-blue-600 hover:underline mb-2 cursor-pointer
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 rounded">
        ← Back
      </button>
      <EntityHeader
        primaryName={entity.primary_name} entityType={entity.type}
        listId={entity.list_id} dataset={entity.dataset}
        schemaType={entity.schema_type} lastSeen={entity.last_seen}
        firstSeen={entity.first_seen}
      />
      <EntityNames names={entity.names} position={entity.position} pepTier={entity.pep_tier} />
      <EntityIdentifiers
        identifiers={entity.identifiers} nationalities={entity.nationalities}
        dateOfBirth={entity.date_of_birth} birthPlace={entity.birth_place}
        birthCountry={entity.birth_country} gender={entity.gender}
      />
      <EntitySanctions
        sanctions={entity.sanctions} programs={entity.programs}
        listingDate={entity.listing_date} remarks={entity.remarks}
        sourceUrl={entity.source_url}
      />
      <EntityContact
        emails={entity.emails} phones={entity.phones}
        websites={entity.websites} addresses={entity.addresses}
      />
      <EntityExtended
        extendedData={entity.extended_data} extra={entity.extra}
        lastChange={entity.last_change}
      />
    </div>
  );
}
