/**
 * HTML Processor Type Definitions
 * All interfaces used by the HTML processing pipeline
 */

export type {
  HTMLProcessingResult,
  HTMLMetadata,
  OpenGraphData,
  TwitterCardData,
  JSONLDData,
  HTMLContent,
  QualityMetrics,
  HTMLOptions,
} from './types-content';

export type {
  HTMLStructure,
  Heading,
  Paragraph,
  HTMLList,
  Table,
  Image,
  Link,
  Form,
  FormField,
  Navigation,
  NavItem,
  Section,
  Footer,
  Header,
} from './types-structure';
