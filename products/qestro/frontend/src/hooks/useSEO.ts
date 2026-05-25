import { useEffect } from 'react';

interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
}

export const useSEO = (config: SEOConfig) => {
  useEffect(() => {
    // Update document title
    if (config.title) {
      document.title = config.title;
    }

    // Update meta tags
    const updateMetaTag = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    const updatePropertyTag = (property: string, content: string) => {
      let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    if (config.description) {
      updateMetaTag('description', config.description);
      updatePropertyTag('og:description', config.description);
    }

    if (config.keywords) {
      updateMetaTag('keywords', config.keywords);
    }

    if (config.image) {
      updatePropertyTag('og:image', config.image);
      updateMetaTag('twitter:image', config.image);
    }

    if (config.url) {
      updatePropertyTag('og:url', config.url);
    }

    if (config.title) {
      updatePropertyTag('og:title', config.title);
      updateMetaTag('twitter:title', config.title);
    }
  }, [config]);
};

export default useSEO;