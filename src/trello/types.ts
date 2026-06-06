export interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}

export interface TrelloChecklistItem {
  id: string;
  name: string;
  state: 'complete' | 'incomplete';
}

export interface TrelloChecklist {
  id: string;
  name: string;
  checkItems: TrelloChecklistItem[];
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  bytes: number;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
  idBoard: string;
  idMembers: string[];
  labels: TrelloLabel[];
  checklists: TrelloChecklist[];
  attachments: TrelloAttachment[];
  url: string;
  closed: boolean;
  dateLastActivity: string;
}

export interface TrelloAction {
  id: string;
  type: string;
  date: string;
  idMemberCreator: string;
  memberCreator: TrelloMember;
  data: {
    card?: { id: string; name: string };
    listAfter?: TrelloList;
    listBefore?: TrelloList;
    board?: { id: string; name: string };
    text?: string;
    member?: TrelloMember;
    label?: { id: string; name: string; color: string };
  };
}

export type Stage = 'epic' | 'planning' | 'dev' | 'test';

// Normalised event emitted by TrelloConnector
export type TrelloEvent =
  | { type: 'card:moved_to_stage'; stage: Stage; cardId: string; boardId: string; listId: string; listName: string }
  | { type: 'card:label_added'; labelName: string; cardId: string; boardId: string }
  | { type: 'comment:added'; cardId: string; boardId: string; memberId: string; text: string; actionId: string };
