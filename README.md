# Athletic Meriti · Check-in e Check-out (versão 2.8.0)

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

## TELA DE CHECK-IN (versão 2.6)

- A tela inicial mostra o **logo do Athletic Meriti** e, embaixo, o botão grande **Reconhecimento facial**. Só ao tocar nele a câmera liga. O app reconhece o rosto, mostra "Entrada em 3… / Saída em 3…" com o botão **Não sou eu**, registra com a foto tirada na hora e volta sozinho para a tela inicial. Se ninguém for reconhecido em 45 segundos, ele também volta (e a câmera desliga).
- Opções secundárias, menores: **QR Code** (aponta a carteirinha) e **Matrícula** (digita os 6 números). Nos dois a foto é tirada em seguida.
- A foto é obrigatória para **entrar**. Na **saída**, só se a câmera falhar tecnicamente o check-out é registrado sem foto.
- O logo e o ícone do app foram trocados. Quem já instalou o app na tela inicial continua vendo o ícone antigo até desinstalar e instalar de novo.

## CADASTRAR O ROSTO

- Ao cadastrar um aluno, o app abre a câmera e tira 4 amostras do rosto (a pessoa olha para a câmera e vira levemente a cabeça).
- Para refazer ou cadastrar depois, use o botão **😀** do aluno na aba **Alunos**.
- **Câmera traseira no cadastro (versão 2.8.0):** no cadastro do rosto a câmera **traseira** abre por padrão, para o professor ou administrador fotografar o aluno com o celular. O botão **🔄 Trocar câmera** alterna entre traseira e frontal, e o aparelho lembra a última escolha. Na foto do aluno (cadastro e edição) use **📷 Tirar foto** (abre a câmera traseira) ou **🖼 Galeria**.
- O check-in dos alunos continua usando a câmera frontal. Se o reconhecimento falhar com alunos cadastrados pela traseira, refaça o rosto pela frontal (botão 😀 → 🔄).
- Na primeira vez o app baixa os arquivos do reconhecimento facial (cerca de 7 MB, precisa de internet); depois eles ficam guardados no aparelho.
- O app guarda apenas números que representam o rosto, mas é **dado biométrico de menores**: peça autorização por escrito dos responsáveis (LGPD).
- Irmãos parecidos podem confundir o reconhecimento. Por isso há a confirmação de 3 segundos com **Não sou eu**.

## COMPARTILHAR QR CODE

- Na carteirinha do aluno (🪪), toque em **Compartilhar** para enviar a imagem (WhatsApp, e-mail etc.).
- Na aba **Alunos**: **Compartilhar todos os QR Codes** gera as imagens de todos.

## IMPRIMIR CARTEIRINHAS

- **Uma carteirinha:** aba Alunos → 🪪 do aluno → **Imprimir esta carteirinha**.
- **Todas de uma vez:** aba Alunos → **Imprimir todas as carteirinhas** (3 por linha, várias por folha).
- **Por esporte:** botão **Imprimir Basquete** ou **Imprimir Futsal** no cabeçalho de cada lista.
- Na janela de impressão do celular escolha a impressora ou **Salvar como PDF**. Se a janela não abrir, use **Compartilhar imagem** e imprima a imagem pela galeria.

## PÁGINA DOS PAIS NÃO ABRE OU DIZ "NÃO ENCONTRADA"

1. Publique as regras do Firebase que estão neste arquivo (Parte 1, item 4). Sem elas a página mostra "Acesso bloqueado".
2. Abra o app atualizado em um aparelho **conectado e com internet**: ele cria sozinho o acesso dos pais de todos os alunos já cadastrados.
3. Use a **matrícula de 4 dígitos** (aparece na aba Alunos).

## NOVIDADES DA VERSÃO 2.4

- **Cadastro completo:** nome do aluno, **ano de nascimento** (a idade é calculada sozinha e aparece na lista), celular do aluno, **responsável 1** (nome e WhatsApp, obrigatórios) e responsável 2 (opcional).
- **Horário por esporte:** ao escolher Basquete e/ou Futsal, aparece a lista de horários de cada um. Os marcados com ✓ são os indicados para a idade. O horário aparece na lista de alunos, na edição e na página dos pais.
- **Matrícula de 6 dígitos:** vale para o check-in e para a página dos pais. Alunos com matrícula antiga de 4 dígitos aparecem num aviso no painel do administrador: toque em **Converter para 6 dígitos** e avise os alunos e os pais (botão 📲).
- **Faltas automáticas às 20h:** o primeiro aparelho aberto e conectado depois das 20h fecha o dia. Quem não fez check-in recebe falta, e o aluno entra na fila de mensagens (aba **Avisos**) com o texto "Sentimos sua falta… qual o motivo?". A mensagem vai para o celular do aluno (ou do responsável, se o aluno não tiver).
- **Motivo da falta:** na aba **Hoje/Histórico**, em **Faltas**, toque em ✏️ para registrar o motivo. Ele entra na planilha.
- **Planilha do dia:** aba **Planilha** → baixar ou compartilhar o arquivo .xlsx com data, presenças, faltas, horários, responsáveis e motivos (abas "Presença" e "Resumo").
- **Dias de treino:** em **Ajustes** (administrador) defina os dias de cada esporte. Já vêm configurados: **Basquete: terça e quinta; Futsal: segunda e quarta**. Se mudar, ajuste aqui.
- As faltas só passam a ser contadas a partir do dia em que esta versão é aberta pela primeira vez.

## IMPORTAR ALUNOS DE UMA PLANILHA (versão 2.5)

1. No celular, guarde o arquivo **alunos-para-importar.json** (ele vem separado do app). **Nunca coloque esse arquivo no GitHub:** ele tem dados de menores e o repositório é público.
2. No app, entre como **administrador** → **Painel → Alunos → 📥 Importar alunos** → escolha o arquivo.
3. O app mostra um resumo (quantos são novos, quantos já estavam cadastrados e serão ignorados). Toque em **Cadastrar**.
4. Informe a **data de início do uso real**. As faltas automáticas só contam a partir dela (também dá para mudar em **Ajustes → Início da contagem de faltas**).
5. Cada aluno recebe uma matrícula de 6 dígitos. Os horários, a foto e o rosto **não vêm da planilha**: complete em **Editar** (horário e foto) e no botão 😀 (rosto). Alunos com dado faltando aparecem com "⚠ Completar".

## ENTRAR E SAIR QUANTAS VEZES QUISER NO DIA (versão 2.8.0)

- O aluno pode fazer check-in, check-out e voltar a entrar quantas vezes quiser no mesmo dia. Cada entrada vira uma linha em **Hoje/Histórico** ("2ª entrada", "3ª entrada"…), com a foto de cada uma. Na página dos pais cada entrada e saída também aparece.
- Para a câmera não registrar sem querer enquanto o aluno ainda está na frente dela, depois de uma entrada ou saída o reconhecimento facial espera **1 minuto** para registrar a ação seguinte. Pela matrícula ou pelo QR Code não há espera.
- Cada entrada e saída gera um aviso na aba **Avisos** para os responsáveis. Com várias idas e vindas, a lista cresce: use **Limpar todos os avisos** quando quiser.
- A falta às 20h só vale para quem não fez nenhum check-in no dia.

## PLANILHA DE FREQUÊNCIA POR PERÍODO (versão 2.7)

Disponível para **administrador e professores**, na aba **Planilha**:
1. Escolha a **modalidade** (Futsal, Basquete ou os dois).
2. Escolha o **período no calendário**: toque na data inicial e depois na final. Não há limite de tamanho. Use as setas e os seletores de mês e ano para ir a qualquer data, ou os atalhos (Hoje, Ontem, Esta semana, Este mês, Mês passado, Este ano, Desde o início).
3. Toque em **Baixar** ou **Compartilhar**. O botão **Planilha de hoje** gera o dia de hoje com um toque.

O arquivo segue o modelo do projeto: nome do aluno, **P** (presença) ou **F** (falta) em cada dia de treino e os totais de Presença e Falta. Se o período passar de um mês, sai **uma folha por mês** (e uma por modalidade) e uma folha **Resumo** com os totais de cada aluno no período e a porcentagem de presença.

- Os dias de treino vêm de **Ajustes → Dias de treino** (Basquete: terça e quinta; Futsal: segunda e quarta).
- **Feriados:** cadastre em **Ajustes → Dias sem treino**. Nesses dias a planilha mostra FERIADO e não há falta.
- **Cabeçalho** (nome do projeto, nº do processo, SLI, proponente): **Ajustes → Cabeçalho da planilha**.
- Presença fora dos dias de treino aparece como um dia extra com P. Antes do início da contagem de faltas (Ajustes) as células ficam em branco.
- Na primeira vez que um período antigo é gerado, o app lê os registros daqueles dias e guarda um resumo leve. Por isso a primeira geração de um período longo pode demorar um pouco; as seguintes são rápidas.
- A planilha só aparece com a coluna do dia depois do fechamento das 20h ou, para o dia de hoje, com as presenças que já aconteceram.

## MENU HAMBÚRGUER (versão 2.8)

- O botão **☰** fica no canto superior esquerdo de todas as telas. Ele abre um menu lateral com as opções a que a pessoa tem acesso.
- **Sem professor logado:** o menu mostra **Início (check-in)** e **Entrar como professor** (pede o PIN).
- **Professor:** Início, **Avisos** (com o número de pendentes), **Presenças de hoje**, **Histórico**, **Planilha de frequência**, **Alunos**, **Cadastrar aluno**, **Ajustes** e **Sair do modo professor**.
- **Administrador:** tudo isso, mais **Professores** e **Importar alunos**.
- A faixa de abas e os botões "Painel" e "Sair" do topo foram substituídos pelo menu. O item da tela em que você está aparece destacado.
- Toque fora do menu, no ✕ ou na tecla Esc para fechar.

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
