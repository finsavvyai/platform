"""
Tests for Citation Service with Citation Tracking and Management
"""

import pytest
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import patch

from app.services.citation_service import (
    CitationService,
    Citation,
    CitationStyle,
    CitationFormat,
    CitationTracker,
)
from app.models.document import DocumentChunk


@pytest.fixture
def citation_service():
    """Citation service instance"""
    return CitationService()


@pytest.fixture
def sample_document_chunks():
    """Sample document chunks with citation information"""
    chunks = []

    sources = [
        {
            "title": "Attention Is All You Need",
            "authors": ["Vaswani, A.", "Shazeer, N.", "Parmar, N."],
            "year": 2017,
            "venue": "NeurIPS",
            "doi": "10.5555/3295222.3295349",
            "type": "academic",
        },
        {
            "title": "BERT: Pre-training of Deep Bidirectional Transformers",
            "authors": ["Devlin, J.", "Chang, M.W.", "Lee, K."],
            "year": 2018,
            "venue": "NAACL",
            "arxiv": "1810.04805",
            "type": "academic",
        },
        {
            "title": "GPT-3 Technical Report",
            "authors": ["Brown, T.", "Mann, B.", "Ryder, N."],
            "year": 2020,
            "venue": "arXiv",
            "arxiv": "2005.14165",
            "type": "preprint",
        },
    ]

    for i, source in enumerate(sources):
        # Create chunks with embedded citations
        content = f"""
        This is content about transformers and attention mechanisms.
        According to the groundbreaking work by {source["authors"][0]} et al. [Source:{i + 1}],
        transformers revolutionized NLP. The model architecture described in their paper [Source:{i + 1}]
        showed that attention mechanisms alone could achieve state-of-the-art results.

        The impact of this work [Source:{i + 1}] has been enormous, leading to numerous follow-up papers.
        Building on this foundation, later models like BPT [Source:{i + 2}] further improved performance.
        More recently, models like GPT [Source:{i + 3}] have scaled these ideas to billions of parameters.
        """

        chunk = DocumentChunk(
            id=f"chunk_{i}",
            document_id=f"doc_{i}",
            content=content,
            chunk_index=i,
            start_pos=i * 500,
            end_pos=(i + 1) * 500,
            token_count=150,
            metadata={
                "source_type": source["type"],
                "citation_info": source,
                "has_citations": True,
                "citation_count": 3,
            },
            embedding=np.random.rand(384).tolist(),
            created_at=datetime.now() - timedelta(days=i),
        )
        chunks.append(chunk)

    return chunks


@pytest.fixture
def sample_citations():
    """Sample citations for testing"""
    return [
        Citation(
            id="cit_1",
            source_type="academic",
            title="Attention Is All You Need",
            authors=[
                {"name": "Ashish Vaswani", "orcid": "0000-0001-6999-9349"},
                {"name": "Noam Shazeer"},
                {"name": "Niki Parmar"},
            ],
            year=2017,
            venue="Neural Information Processing Systems",
            volume=30,
            pages=5998 - 6008,
            doi="10.5555/3295222.3295349",
            url="https://arxiv.org/abs/1706.03762",
            abstract="The dominant sequence transduction models...",
            citation_count=45000,
        ),
        Citation(
            id="cit_2",
            source_type="academic",
            title="BERT: Pre-training of Deep Bidirectional Transformers",
            authors=[
                {"name": "Jacob Devlin"},
                {"name": "Ming-Wei Chang"},
                {"name": "Kenton Lee"},
            ],
            year=2018,
            venue="Conference of the North American Chapter of the ACL",
            pages=4171 - 4186,
            arxiv="1810.04805",
            url="https://arxiv.org/abs/1810.04805",
            abstract="We introduce a new language representation model...",
            citation_count=38000,
        ),
    ]


class TestCitationService:
    """Test cases for CitationService"""

    @pytest.mark.asyncio
    async def test_extract_citations_from_text(
        self, citation_service, sample_document_chunks
    ):
        """Test extraction of citations from text content"""
        # Setup
        chunk = sample_document_chunks[0]

        # Execute
        citations = await citation_service.extract_citations(chunk.content)

        # Verify
        assert isinstance(citations, list)
        assert len(citations) > 0

        for citation in citations:
            assert isinstance(citation, Citation)
            assert citation.source_marker is not None
            assert citation.position is not None

    @pytest.mark.asyncio
    async def test_generate_citation_apa_style(
        self, citation_service, sample_citations
    ):
        """Test APA style citation generation"""
        # Setup
        citation = sample_citations[0]

        # Execute
        formatted = await citation_service.format_citation(
            citation, style=CitationStyle.APA
        )

        # Verify
        assert isinstance(formatted, str)
        assert "Vaswani" in formatted
        assert "2017" in formatted
        assert "Neural Information Processing Systems" in formatted

    @pytest.mark.asyncio
    async def test_generate_citation_mla_style(
        self, citation_service, sample_citations
    ):
        """Test MLA style citation generation"""
        # Setup
        citation = sample_citations[0]

        # Execute
        formatted = await citation_service.format_citation(
            citation, style=CitationStyle.MLA
        )

        # Verify
        assert isinstance(formatted, str)
        assert "Vaswani" in formatted
        assert "2017" in formatted

    @pytest.mark.asyncio
    async def test_generate_citation_chicago_style(
        self, citation_service, sample_citations
    ):
        """Test Chicago style citation generation"""
        # Setup
        citation = sample_citations[0]

        # Execute
        formatted = await citation_service.format_citation(
            citation, style=CitationStyle.CHICAGO
        )

        # Verify
        assert isinstance(formatted, str)
        assert "Vaswani" in formatted
        assert "2017" in formatted

    @pytest.mark.asyncio
    async def test_in_text_citation_generation(
        self, citation_service, sample_citations
    ):
        """Test in-text citation generation"""
        # Setup
        citation = sample_citations[0]

        # Test parenthetical citation
        parenthetical = await citation_service.generate_in_text_citation(
            citation, format=CitationFormat.PARENTHETICAL
        )
        assert "(Vaswani et al., 2017)" == parenthetical

        # Test narrative citation
        narrative = await citation_service.generate_in_text_citation(
            citation, format=CitationFormat.NARRATIVE
        )
        assert "Vaswani et al. (2017)" == narrative

    @pytest.mark.asyncio
    async def test_citation_validation(self, citation_service):
        """Test citation validation"""
        # Valid citation
        valid_citation = Citation(
            id="valid_1",
            source_type="academic",
            title="Test Paper",
            authors=[{"name": "Test Author"}],
            year=2023,
            venue="Test Conference",
        )

        validation = await citation_service.validate_citation(valid_citation)
        assert validation.is_valid
        assert validation.errors == []

        # Invalid citation - missing required fields
        invalid_citation = Citation(
            id="invalid_1",
            source_type="academic",
            # Missing title, authors, year
        )

        validation = await citation_service.validate_citation(invalid_citation)
        assert not validation.is_valid
        assert len(validation.errors) > 0

    @pytest.mark.asyncio
    async def test_citation_normalization(self, citation_service):
        """Test citation normalization"""
        # Setup - citation with inconsistent formatting
        raw_citation = {
            "title": "  ATTENTION IS ALL YOU NEED  ",
            "authors": ["vaswani, ashish", "shazeer, noam"],
            "year": "2017",
            "venue": "neurips",
        }

        # Execute
        normalized = await citation_service.normalize_citation(raw_citation)

        # Verify
        assert isinstance(normalized, Citation)
        assert normalized.title == "Attention Is All You Need"  # Title case
        assert len(normalized.authors) == 2
        assert normalized.authors[0]["name"] == "Ashish Vaswani"  # Proper case
        assert isinstance(normalized.year, int)  # Converted to int

    @pytest.mark.asyncio
    async def test_duplicate_citation_detection(
        self, citation_service, sample_citations
    ):
        """Test detection of duplicate citations"""
        # Create duplicate citation
        duplicate = Citation(
            id="dup_1",
            source_type="academic",
            title="Attention Is All You Need",  # Same title
            authors=[{"name": "A. Vaswani"}, {"name": "N. Shazeer"}],  # Similar authors
            year=2017,
            venue="NeurIPS",
        )

        # Execute
        duplicates = await citation_service.find_duplicates(
            sample_citations + [duplicate]
        )

        # Verify
        assert len(duplicates) > 0
        assert any(
            dup["original_id"] == "cit_1" and dup["duplicate_id"] == "dup_1"
            for dup in duplicates
        )

    @pytest.mark.asyncio
    async def test_citation_merge(self, citation_service, sample_citations):
        """Test merging of duplicate citations"""
        # Setup - create partial citations
        citation_a = Citation(
            id="cit_a",
            source_type="academic",
            title="Attention Is All You Need",
            authors=[{"name": "Ashish Vaswani"}],
            year=2017,
        )

        citation_b = Citation(
            id="cit_b",
            source_type="academic",
            title="Attention Is All You Need",
            authors=[{"name": "Noam Shazeer"}],
            venue="NeurIPS",
            doi="10.5555/3295222.3295349",
        )

        # Execute
        merged = await citation_service.merge_citations([citation_a, citation_b])

        # Verify
        assert isinstance(merged, Citation)
        assert len(merged.authors) == 2  # Combined authors
        assert merged.venue == "NeurIPS"  # From citation_b
        assert merged.doi == "10.5555/3295222.3295349"  # From citation_b

    @pytest.mark.asyncio
    async def test_citation_tracking(self, citation_service, sample_document_chunks):
        """Test tracking citations across documents"""
        # Execute
        tracker = await citation_service.track_citations(sample_document_chunks)

        # Verify
        assert isinstance(tracker, CitationTracker)
        assert len(tracker.citation_map) > 0
        assert tracker.total_citations > 0

        # Check citation frequency
        citation_counts = tracker.get_citation_counts()
        assert len(citation_counts) > 0
        assert all(count > 0 for count in citation_counts.values())

    @pytest.mark.asyncio
    async def test_citation_network_analysis(self, citation_service, sample_citations):
        """Test citation network analysis"""
        # Setup - add citations that reference each other
        network_citations = sample_citations.copy()
        network_citations.append(
            Citation(
                id="cit_3",
                source_type="academic",
                title="Follow-up Work on Transformers",
                authors=[{"name": "New Author"}],
                year=2020,
                references=["cit_1"],  # References first paper
            )
        )

        # Execute
        network = await citation_service.build_citation_network(network_citations)

        # Verify
        assert network is not None
        assert len(network.nodes) > 0
        assert len(network.edges) > 0

        # Check network metrics
        metrics = await citation_service.calculate_network_metrics(network)
        assert "density" in metrics
        assert "clustering_coefficient" in metrics
        assert "average_path_length" in metrics

    @pytest.mark.asyncio
    async def test_citation_lookup_by_doi(self, citation_service):
        """Test citation lookup by DOI"""
        # Setup
        doi = "10.5555/3295222.3295349"

        # Mock external API response
        mock_response = {
            "title": "Attention Is All You Need",
            "author": [{"given": "Ashish", "family": "Vaswani"}],
            "issued": {"date-parts": [[2017]]},
            "container-title": ["Neural Information Processing Systems"],
        }

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.return_value.json.return_value = mock_response
            mock_get.return_value.status_code = 200

            # Execute
            citation = await citation_service.lookup_by_doi(doi)

            # Verify
            assert isinstance(citation, Citation)
            assert citation.title == "Attention Is All You Need"
            assert citation.doi == doi

    @pytest.mark.asyncio
    async def test_citation_lookup_by_arxiv(self, citation_service):
        """Test citation lookup by arXiv ID"""
        # Setup
        arxiv_id = "1810.04805"

        # Mock arXiv API response
        mock_response = {
            "entry": [
                {
                    "title": ["BERT: Pre-training of Deep Bidirectional Transformers"],
                    "author": [{"name": "Jacob Devlin"}],
                    "published": ["2018-10-11"],
                    "arxiv:doi": ["10.18653/v1/N19-1423"],
                }
            ]
        }

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.return_value.json.return_value = mock_response
            mock_get.return_value.status_code = 200

            # Execute
            citation = await citation_service.lookup_by_arxiv(arxiv_id)

            # Verify
            assert isinstance(citation, Citation)
            assert "BERT" in citation.title
            assert citation.arxiv == arxiv_id

    @pytest.mark.asyncio
    async def test_citation_import_bibtex(self, citation_service):
        """Test importing citations from BibTeX"""
        # Setup
        bibtex = """
        @inproceedings{vaswani2017attention,
          title={Attention Is All You Need},
          author={Vaswani, Ashish and Shazeer, Noam and Parmar, Niki},
          booktitle={NeurIPS},
          year={2017},
          doi={10.5555/3295222.3295349}
        }
        """

        # Execute
        citations = await citation_service.import_from_bibtex(bibtex)

        # Verify
        assert isinstance(citations, list)
        assert len(citations) == 1

        citation = citations[0]
        assert citation.title == "Attention Is All You Need"
        assert len(citation.authors) == 3
        assert citation.year == 2017

    @pytest.mark.asyncio
    async def test_citation_export_bibtex(self, citation_service, sample_citations):
        """Test exporting citations to BibTeX"""
        # Execute
        bibtex = await citation_service.export_to_bibtex(sample_citations)

        # Verify
        assert isinstance(bibtex, str)
        assert "@inproceedings{" in bibtex
        assert "title={Attention Is All You Need}" in bibtex
        assert "author={Vaswani, Ashish}" in bibtex

    @pytest.mark.asyncio
    async def test_citation_quality_assessment(
        self, citation_service, sample_citations
    ):
        """Test citation quality assessment"""
        # Execute
        for citation in sample_citations:
            quality = await citation_service.assess_citation_quality(citation)

            # Verify
            assert isinstance(quality, dict)
            assert "completeness_score" in quality
            assert "reliability_score" in quality
            assert "overall_score" in quality
            assert 0 <= quality["overall_score"] <= 1

    @pytest.mark.asyncio
    async def test_citation_suggestions(self, citation_service, sample_document_chunks):
        """Test citation suggestions for uncited content"""
        # Setup - create chunk without citations
        uncited_chunk = DocumentChunk(
            id="uncited_1",
            document_id="doc_uncited",
            content="Transformers use self-attention mechanisms instead of recurrence.",
            chunk_index=0,
            token_count=15,
            metadata={"source_type": "internal"},
        )

        # Execute
        suggestions = await citation_service.suggest_citations(
            uncited_chunk, sample_citations
        )

        # Verify
        assert isinstance(suggestions, list)
        assert len(suggestions) > 0

        for suggestion in suggestions:
            assert isinstance(suggestion, dict)
            assert "citation" in suggestion
            assert "confidence" in suggestion
            assert "reason" in suggestion

    @pytest.mark.asyncio
    async def test_batch_citation_processing(
        self, citation_service, sample_document_chunks
    ):
        """Test batch processing of citations"""
        # Execute
        results = await citation_service.batch_process_citations(sample_document_chunks)

        # Verify
        assert isinstance(results, list)
        assert len(results) == len(sample_document_chunks)

        for result in results:
            assert "chunk_id" in result
            assert "citations" in result
            assert isinstance(result["citations"], list)

    @pytest.mark.asyncio
    async def test_citation_style_conversion(self, citation_service, sample_citations):
        """Test conversion between citation styles"""
        # Setup
        citation = sample_citations[0]

        # Test APA to MLA conversion
        apa_citation = await citation_service.format_citation(
            citation, style=CitationStyle.APA
        )
        mla_citation = await citation_service.format_citation(
            citation, style=CitationStyle.MLA
        )

        # Verify
        assert isinstance(apa_citation, str)
        assert isinstance(mla_citation, str)
        assert apa_citation != mla_citation  # Different formats

    @pytest.mark.asyncio
    async def test_citation_disambiguation(self, citation_service):
        """Test disambiguation of similar citations"""
        # Setup - create similar citations
        similar_citations = [
            Citation(
                id="sim_1",
                source_type="academic",
                title="Deep Learning",
                authors=[{"name": "Ian Goodfellow"}],
                year=2016,
            ),
            Citation(
                id="sim_2",
                source_type="book",
                title="Deep Learning",
                authors=[{"name": "Ian Goodfellow"}],
                year=2016,
                publisher="MIT Press",
            ),
        ]

        # Execute
        disambiguated = await citation_service.disambiguate_citations(similar_citations)

        # Verify
        assert len(disambiguated) == 2
        for citation in disambiguated:
            assert hasattr(citation, "disambiguation_info")
            assert citation.disambiguation_info is not None

    @pytest.mark.asyncio
    async def test_citation_version_tracking(self, citation_service):
        """Test tracking of different citation versions"""
        # Setup - create citation versions
        original = Citation(
            id="orig_1",
            source_type="academic",
            title="Original Title",
            version=1,
        )

        updated = Citation(
            id="orig_1",
            source_type="academic",
            title="Updated Title",
            version=2,
        )

        # Execute
        versions = await citation_service.track_citation_versions([original, updated])

        # Verify
        assert len(versions) == 2
        assert versions[0].version == 1
        assert versions[1].version == 2
        assert versions[1].previous_version_id == versions[0].id

    @pytest.mark.asyncio
    async def test_citation_crossref_integration(self, citation_service):
        """Test integration with Crossref API"""
        # Setup
        query = "Attention Is All You Need"

        # Mock Crossref API response
        mock_response = {
            "message": {
                "items": [
                    {
                        "title": ["Attention Is All You Need"],
                        "author": [{"given": "Ashish", "family": "Vaswani"}],
                        "published": {"date-parts": [[2017, 1, 1]]},
                        "DOI": "10.5555/3295222.3295349",
                    }
                ]
            }
        }

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.return_value.json.return_value = mock_response
            mock_get.return_value.status_code = 200

            # Execute
            results = await citation_service.search_crossref(query)

            # Verify
            assert isinstance(results, list)
            assert len(results) > 0
            assert results[0]["title"] == "Attention Is All You Need"

    @pytest.mark.asyncio
    async def test_citation_orcid_lookup(self, citation_service):
        """Test author information lookup via ORCID"""
        # Setup
        orcid = "0000-0001-6999-9349"  # Ashish Vaswani's ORCID

        # Mock ORCID API response
        mock_response = {
            "person": {
                "name": {
                    "given-names": {"value": "Ashish"},
                    "family-name": {"value": "Vaswani"},
                }
            }
        }

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.return_value.json.return_value = mock_response
            mock_get.return_value.status_code = 200

            # Execute
            author_info = await citation_service.lookup_author_by_orcid(orcid)

            # Verify
            assert isinstance(author_info, dict)
            assert author_info["given_names"] == "Ashish"
            assert author_info["family_name"] == "Vaswani"

    def test_citation_validation_rules(self, citation_service):
        """Test citation validation rules"""
        # Test DOI validation
        valid_doi = "10.5555/3295222.3295349"
        invalid_doi = "invalid-doi"

        assert citation_service.validate_doi(valid_doi)
        assert not citation_service.validate_doi(invalid_doi)

        # Test ORCID validation
        valid_orcid = "0000-0001-6999-9349"
        invalid_orcid = "invalid-orcid"

        assert citation_service.validate_orcid(valid_orcid)
        assert not citation_service.validate_orcid(invalid_orcid)

        # Test arXiv ID validation
        valid_arxiv = "1810.04805"
        invalid_arxiv = "invalid-arxiv"

        assert citation_service.validate_arxiv_id(valid_arxiv)
        assert not citation_service.validate_arxiv_id(invalid_arxiv)

    @pytest.mark.asyncio
    async def test_citation_error_handling(self, citation_service):
        """Test error handling in citation operations"""
        # Test with invalid DOI
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.return_value.status_code = 404

            citation = await citation_service.lookup_by_doi("invalid.doi")
            assert citation is None

        # Test with malformed BibTeX
        malformed_bibtex = "@invalid{"
        citations = await citation_service.import_from_bibtex(malformed_bibtex)
        assert citations == []

    @pytest.mark.asyncio
    async def test_citation_caching(self, citation_service, sample_citations):
        """Test citation lookup caching"""
        # Setup
        doi = "10.5555/3295222.3295349"

        # Mock API response
        mock_response = {
            "title": "Attention Is All You Need",
            "author": [{"given": "Ashish", "family": "Vaswani"}],
        }

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.return_value.json.return_value = mock_response
            mock_get.return_value.status_code = 200

            # First lookup
            result1 = await citation_service.lookup_by_doi(doi)

            # Second lookup (should use cache)
            result2 = await citation_service.lookup_by_doi(doi)

            # Verify
            assert result1 == result2
            # API should only be called once
            assert mock_get.call_count == 1

    @pytest.mark.asyncio
    async def test_citation_statistics(self, citation_service, sample_citations):
        """Test citation statistics calculation"""
        # Execute
        stats = await citation_service.calculate_statistics(sample_citations)

        # Verify
        assert isinstance(stats, dict)
        assert "total_citations" in stats
        assert "average_citation_count" in stats
        assert "publication_years_range" in stats
        assert "most_common_venues" in stats
        assert "author_collaboration_network" in stats

        assert stats["total_citations"] == len(sample_citations)
        assert stats["average_citation_count"] > 0

    @pytest.mark.asyncio
    async def test_citation_recommendations(self, citation_service, sample_citations):
        """Test citation recommendations based on existing citations"""
        # Setup
        base_citation = sample_citations[0]  # Transformer paper

        # Execute
        recommendations = await citation_service.get_recommendations(base_citation)

        # Verify
        assert isinstance(recommendations, list)
        assert len(recommendations) > 0

        for rec in recommendations:
            assert isinstance(rec, dict)
            assert "citation" in rec
            assert "relevance_score" in rec
            assert "reason" in rec
            assert 0 <= rec["relevance_score"] <= 1
