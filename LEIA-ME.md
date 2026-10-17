# Athletic Meriti · Check-in e Check-out (versão 2.2.0)

## PARTE 1 · Criar o banco na nuvem (Firebase, grátis) · só uma vez

1. Acesse **console.firebase.google.com** com sua conta Google e toque em **Criar um projeto**. Dê um nome (ex.: athletic-meriti). Pode desativar o Google Analytics.
2. Na tela inicial do projeto, toque no ícone **</>** (Web). Dê um apelido e toque em **Registrar app**. Vai aparecer um bloco chamado `firebaseConfig`: **deixe essa tela aberta** (ou copie os valores).
3. Menu **Criação → Firestore Database → Criar banco de dados**. Local: **southamerica-east1 (São Paulo)**. Modo: **produção**.
4. Dentro do Firestore, aba **Regras**. Apague tudo, cole o texto abaixo e toque em **Publicar**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /portal/{token} {
      allow get: if true;
      allow write: if request.auth != null;
      match /events/{ev} {
        allow read: if true;
        allow write: if request.auth != null;
      }
    }
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

(As regras de `portal` permitem que os pais, sem login, vejam só os dados de quem tem a matrícula. Quem já publicou as regras antigas precisa publicar estas.)

5. Menu **Criação → Authentication → Vamos começar → E-mail/senha → Ativar → Salvar**.
6. Na aba **Usuários → Adicionar usuário**: crie um e-mail e senha. Esta é a **conta dos aparelhos** (não precisa ser e-mail real). Use a mesma conta em todos os celulares e no tablet.

## PARTE 2 · Colocar os dados no app (GitHub)

1. No GitHub, abra seu repositório e envie todos os arquivos desta pasta (**Add file → Upload files**). Arquivos com o mesmo nome serão substituídos.
2. Abra o arquivo **firebase-config.js**, toque no lápis (editar) e troque cada `COLE_AQUI` pelos valores do `firebaseConfig` da etapa 2. Mantenha as aspas. Toque em **Commit changes**.
3. Em 1 a 2 minutos, abra o endereço do GitHub Pages no celular, entre com a conta dos aparelhos e instale o app (três pontinhos → Instalar app).

## PARTE 3 · Primeiro uso

1. Toque em **Professor**: como não há professores, o app pede para criar o **administrador** (nome + PIN de 4 números).
2. No painel, aba **Professores**, cadastre os outros professores. Na aba **+ Aluno**, cadastre os alunos, escolha o esporte (Basquete, Futsal ou os dois) e, se quiser, a foto.
3. Na aba **Alunos**, toque em 🪪 para ver e imprimir a carteirinha com QR Code.
4. No tablet da quadra deixe a tela inicial: os alunos tocam na bola do esporte, escolhem o nome e digitam o código (ou leem o QR Code). O app tira a foto e registra.

## PÁGINA DOS PAIS

- Endereço: o mesmo do app, trocando o final por **pais.html** (ex.: `https://seunome.github.io/athletic-meriti/pais.html`). Ele também aparece em **Painel → Ajustes → Página dos pais**.
- O **código de 4 dígitos** do aluno (o mesmo do check-in, visível na aba **Alunos**) é o acesso dos pais. Eles digitam o código e veem entrada, saída, duração e as fotos do check-in, ao vivo.
- O botão **📲** do aluno envia pelo WhatsApp o link já com o código.
- Se o código vazar, abra **Editar** no aluno e toque em **Gerar novo código**: o antigo deixa de funcionar (no check-in e para os pais) e o histórico é mantido.
- Os pais veem só o primeiro nome do aluno e os últimos 30 registros.
- Atenção: um código de 4 dígitos tem só 10.000 combinações. Quem insistir em tentar códigos pode acabar vendo dados de outros alunos. Se isso preocupar, peça a versão que exige também o primeiro nome do aluno.

## FOTO NO CHECK-IN

A foto é obrigatória para **entrar**: sem câmera liberada, o check-in não é feito. Na **saída**, a foto também é tirada; só se a câmera falhar tecnicamente o check-out é registrado sem foto, para o aluno não ficar preso como "na quadra".

## COMO ATUALIZAR O APP NOS CELULARES

1. No GitHub, envie os arquivos novos (**Add file → Upload files**) e toque em **Commit changes**. **Não substitua o firebase-config.js.**
2. Espere 1 a 2 minutos.
3. Em cada celular, com internet, **feche o app por completo e abra de novo**. Se ainda aparecer a versão antiga, feche e abra mais uma vez.
4. Confira o número da versão no rodapé da tela inicial.

Os dados (alunos, presenças, fotos) ficam no Firebase, então **nenhuma atualização apaga dados**.

## Observações

- Segurança: o PIN do professor é uma proteção de uso do app, não um sistema bancário. Quem tiver a conta dos aparelhos consegue, por meios técnicos, ler os dados. Não compartilhe essa senha.
- Fotos dos alunos: por serem dados de menores, peça autorização por escrito dos responsáveis.
- Sem internet o app abre e registra; tudo sincroniza quando a conexão volta.
- Gratuito: o plano grátis do Firebase comporta com folga um projeto deste tamanho.
