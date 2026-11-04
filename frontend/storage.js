'use strict';
// Paths de GitHub Pages da mesma conta compartilham a origem. Nunca reutilizar
// as chaves do site principal na homologação, nem mesmo para ler configuração.
window.IASDPIStorage = (() => {
  const namespace=window.IASDPIConfig?.storageNamespace || '';
  if(namespace&&!/^[a-z0-9-]{1,80}$/.test(namespace))throw Error('Namespace de armazenamento inválido.');
  const key=name=>namespace?namespace+':'+name:name;
  const scope=name=>key(window.IASDPIChurches?.storageScope(name)||name);
  return Object.freeze({scope,programs:scope('iasdpi-demo-v1'),safety:scope('iasdpi-last-safety-copy-v1'),
    beforeRestore:scope('iasdpi-before-restore-v1'),cloudConfig:key('iasdpi-cloud-config'),pending:scope('iasdpi-cloud-pending'),
    authSession:key('iasdpi-supabase-auth-v1'),dateCorrections:scope('iasdpi-date-correction-backups-v1')});
})();
