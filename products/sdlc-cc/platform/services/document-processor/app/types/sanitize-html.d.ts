declare module 'sanitize-html' {
  interface IOptions {
    allowedTags?: string[] | false;
    allowedAttributes?: Record<string, string[]> | false;
    allowedStyles?: Record<string, Record<string, RegExp[]>>;
    allowedClasses?: Record<string, string[] | boolean>;
    allowedSchemes?: string[];
    allowedSchemesByTag?: Record<string, string[]>;
    allowedSchemesAppliedToAttributes?: string[];
    allowProtocolRelative?: boolean;
    enforceHtmlBoundary?: boolean;
    parseStyleAttributes?: boolean;
    transformTags?: Record<string, string | ((tagName: string, attribs: Record<string, string>) => { tagName: string; attribs: Record<string, string> })>;
    exclusiveFilter?: (frame: { tag: string; attribs: Record<string, string>; text: string; tagPosition: number }) => boolean;
    textFilter?: (text: string, tagName: string) => string;
    nonTextTags?: string[];
    nestingLimit?: number;
  }

  function sanitize(dirty: string, options?: IOptions): string;

  namespace sanitize {
    function defaults(): IOptions;
    function simpleTransform(tagName: string, attribs: Record<string, string>, merge?: boolean): (tagName: string, attribs: Record<string, string>) => { tagName: string; attribs: Record<string, string> };
  }

  export = sanitize;
}
