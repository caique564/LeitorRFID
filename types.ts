
export interface NFCTagData {
  serialNumber: string;
  records: Array<{
    recordType: string;
    data: string;
    encoding?: string;
  }>;
  timestamp: string;
}

export enum AppState {
  IDLE = 'IDLE',
  SCANNING_NFC = 'SCANNING_NFC',
  SCANNING_VISION = 'SCANNING_VISION',
  READING = 'READING',
  RESULT = 'RESULT',
  ERROR = 'ERROR',
  UNSUPPORTED = 'UNSUPPORTED',
  SECURITY_BLOCKED = 'SECURITY_BLOCKED'
}
