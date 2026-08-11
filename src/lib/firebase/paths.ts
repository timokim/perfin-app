export function userDoc(uid: string) {
  return `users/${uid}`;
}

export function accountsCol(uid: string) {
  return `users/${uid}/accounts`;
}

export function categoriesCol(uid: string) {
  return `users/${uid}/categories`;
}

export function importsCol(uid: string) {
  return `users/${uid}/imports`;
}

export function transactionsCol(uid: string) {
  return `users/${uid}/transactions`;
}

export function settingsCol(uid: string) {
  return `users/${uid}/settings`;
}

export function budgetSettingsDoc(uid: string) {
  return `${settingsCol(uid)}/budget`;
}
