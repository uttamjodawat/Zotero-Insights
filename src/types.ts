export interface ZoteroItem {
  key: string;
  version: number;
  library: {
    type: string;
    id: number;
    name: string;
    links: {
      alternate: {
        href: string;
        type: string;
      };
    };
  };
  links: {
    self: {
      href: string;
      type: string;
    };
    alternate: {
      href: string;
      type: string;
    };
  };
  meta: {
    creatorSummary: string;
    parsedDate: string;
    numChildren: number;
    readingProgress?: number;
    attachmentKey?: string;
    lastPage?: number;
    annotationCount?: number;
    collections?: string[];
  };
  data: {
    key: string;
    version: number;
    itemType: string;
    title: string;
    creators: Array<{
      creatorType: string;
      firstName?: string;
      lastName?: string;
      name?: string;
    }>;
    abstractNote: string;
    publicationTitle: string;
    volume: string;
    issue: string;
    pages: string;
    date: string;
    series: string;
    seriesTitle: string;
    seriesText: string;
    journalAbbreviation: string;
    language: string;
    DOI: string;
    ISSN: string;
    shortTitle: string;
    url: string;
    accessDate: string;
    archive: string;
    archiveLocation: string;
    libraryCatalog: string;
    callNumber: string;
    rights: string;
    extra: string;
    tags: Array<{
      tag: string;
      type: number;
    }>;
    collections: string[];
    relations: Record<string, string>;
    dateAdded: string;
    dateModified: string;
  };
}

export interface ZoteroCollection {
  key: string;
  version: number;
  data: {
    key: string;
    version: number;
    name: string;
    parentCollection: string | boolean;
    relations: Record<string, string>;
  };
}

export interface AuthPayload {
  token: string;
  secret: string;
  username: string;
  userID: string;
  apiKey?: string;
  libraryType?: 'user' | 'group';
}
