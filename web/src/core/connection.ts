/** What the connection badge says. Words, not just colour. */
export function connectionLabel(online: boolean): { text: string; detail: string } {
  return online
    ? { text: 'Live', detail: 'Online: showing live NASA data.' }
    : {
        text: 'Offline',
        detail:
          'No connection: showing data saved earlier on this device. Places you have not opened online will be missing.',
      }
}
