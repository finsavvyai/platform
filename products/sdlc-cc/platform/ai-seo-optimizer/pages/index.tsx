import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Header from '../components/Header';
import Hero from '../components/Hero';
import TrustBar from '../components/TrustBar';

const Features = dynamic(() => import('../components/Features'));
const Comparison = dynamic(() => import('../components/Comparison'));
const HowItWorks = dynamic(() => import('../components/HowItWorks'));
const DashboardPreview = dynamic(() => import('../components/DashboardPreview'));
const Pricing = dynamic(() => import('../components/Pricing'));
const Waitlist = dynamic(() => import('../components/Waitlist'));
const Footer = dynamic(() => import('../components/Footer'));

const HomePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>RankAI — SEO for the AI Era | Get Cited by AI Agents</title>
        <meta
          name="description"
          content="RankAI optimizes your content for ChatGPT, Perplexity, Gemini, and Claude. Track AI citations, boost your AI Visibility Score, and get discovered in AI-generated answers."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="RankAI — SEO for the AI Era" />
        <meta
          property="og:description"
          content="Optimize your content for AI agents. Track citations across ChatGPT, Perplexity, Gemini, and Claude."
        />
        <meta property="twitter:card" content="summary_large_image" />
        <link rel="canonical" href="https://rankai.io/" />
      </Head>

      <div className="min-h-screen">
        <Header />
        <Hero />
        <TrustBar />
        <Features />
        <Comparison />
        <HowItWorks />
        <DashboardPreview />
        <Pricing />
        <Waitlist />
        <Footer />
      </div>
    </>
  );
};

export default HomePage;
