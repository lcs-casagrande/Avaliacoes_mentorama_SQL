// Preparação do provisionamento individual; não cria contas nem emite credenciais por si só.
// Usar só no servidor, após autorização; nunca importar no frontend ou registrar resultado.
export function temporaryPassword(randomBytes=n=>crypto.getRandomValues(new Uint8Array(n))){
 const bytes=randomBytes(24);
 if(!(bytes instanceof Uint8Array)||bytes.length!==24)throw Error('Fonte criptográfica inválida.');
 return 'T!9a'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
