export type EventType = 'oncall' | 'incident';
 
export const isValidEventType = (type: string): type is EventType => {
  return type === 'oncall' || type === 'incident';
}; 