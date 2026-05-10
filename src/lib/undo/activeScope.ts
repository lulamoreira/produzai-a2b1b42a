let _activeScope = "";

export function setActiveScope(scope: string) {
  _activeScope = scope;
}

export function getActiveScope(): string {
  return _activeScope;
}

export function clearActiveScope(scope: string) {
  if (_activeScope === scope) _activeScope = "";
}
