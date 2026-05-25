/**
 * HTML Processor - Backward Compatibility Re-export
 * All implementation has been split into html-processor/ directory
 */

export {
  HTMLProcessor,
} from './html-processor/index';

export type {
  HTMLProcessingResult,
  HTMLMetadata,
  OpenGraphData,
  TwitterCardData,
  JSONLDData,
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
  HTMLContent,
  QualityMetrics,
  HTMLOptions,
} from './html-processor/types';
