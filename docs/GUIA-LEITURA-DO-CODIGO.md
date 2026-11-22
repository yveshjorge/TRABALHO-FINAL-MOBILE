# Guia de leitura e defesa do código — Léxica Mobile

Este material acompanha o [Guia de apresentação](GUIA-DE-APRESENTACAO.md). Ele explica como as peças do código trabalham juntas, para que serve cada arquivo escrito para o app e como responder com precisão sobre a integração de Firebase, Firestore e SQLite.

O objetivo não é decorar nomes. Para defender o projeto, cada integrante deve conseguir seguir uma operação da tela até o banco local e, depois, até o banco na nuvem.

## 1. O projeto em uma frase

O Léxica é um app Expo/React Native offline-first: a tela lê e grava projetos, glossários e termos no SQLite; uma fila local registra o que falta sincronizar; Firebase Authentication identifica a conta; e uma rotina própria envia e recebe esses registros do Cloud Firestore quando existe conexão.

“Offline-first” descreve a ordem do trabalho: o app persiste primeiro no celular. Não quer dizer que o Firestore JavaScript esteja configurado com cache offline automático. A fila e a sincronização são implementadas pelo próprio projeto.

## 2. Mapa mental: como as peças se ligam

    index.ts
      inicia o componente App
        App.tsx
          observa a sessão Firebase Authentication
          escolhe AuthScreen ou as abas do aplicativo
          verifica a rede e chama synchronize()
          apresenta CrudScreen ou OpusScreen
            CrudScreen
              usa definitions + validation
              chama database.ts para ler/gravar SQLite
              avisa App que a lista mudou
            OpusScreen
              chama opus.ts para catálogo/importação/MyMemory
              chama database.ts para pesquisar TMX local
        firebase.ts
          inicializa Firebase Auth e Firestore com configuração pública do ambiente
        sync.ts
          transfere registros entre outbox/records do SQLite e subcoleções Firestore

Uma alteração comum percorre esta cadeia:

    formulário → validação → registro com id/datas → transação SQLite
    → tabela records + tabela outbox → tentativa de sincronização
    → setDoc no caminho do UID → confirmação local e remoção da outbox

## 3. A integração mais importante: SQLite + Firebase

### 3.1 Por que existem os dois bancos?

- SQLite é o banco relacional incluído no aparelho. Mantém os registros acessíveis sem rede e permite que salvar seja imediato.
- Firestore é o banco na nuvem associado à conta. Permite recuperar os registros da mesma pessoa depois de entrar em outro aparelho que tenha o app e a mesma conta.
- Firebase Authentication não é um banco de projetos. Ele autentica a pessoa e fornece um UID estável, usado como proprietário dos dados.
- A outbox é a lista local do trabalho ainda não confirmado pelo Firestore.

O app não grava diretamente na nuvem a cada toque em Salvar. Salvar grava no SQLite. A sincronização é acionada pelo botão, pela detecção de internet, ao entrar na sessão e quando o app volta ao primeiro plano.

### 3.2 Identidade e isolamento local

Depois do login, App.tsx recebe o User do Firebase. O código passa o UID como ownerId para a tela CRUD. O mesmo UID é usado:

1. Como parte da chave dos registros locais, para separar contas no SQLite.
2. Para construir caminhos remotos sob users/{uid}.
3. Nas Firestore Rules, que comparam o UID do token autenticado com o UID do caminho.

O modo de demonstração usa ownerId demo-local. Ele não chama Firebase Authentication e suas linhas locais não entram no caminho Firestore de uma pessoa real.

### 3.3 O que é guardado no SQLite

A inicialização de src/database.ts cria as tabelas:

| Tabela | Responsabilidade |
|---|---|
| records | Cópia local dos registros de projetos, glossários e termos, identificados por owner, entidade e id. Armazena o JSON e estado de sincronização. |
| outbox | Operações locais ainda não confirmadas no Firestore. Há no máximo uma operação atual por owner, entidade e registro. |
| app_metadata | Marcadores simples do app, como o controle para não semear os exemplos de demonstração de novo. |
| tm_datasets | Metadados de cada amostra TMX baixada do OPUS. |
| tm_pairs | Pares de texto de origem e destino consultados offline. |

records e outbox são alteradas na mesma transação quando o usuário salva. Isso evita a situação em que o registro fica no SQLite, mas a operação que deveria enviá-lo se perde, ou o contrário.

### 3.4 Fluxo de salvar, sem internet ou com internet

1. A pessoa toca Salvar na tela.
2. CrudScreen valida o formulário.
3. toRecord normaliza espaços e cria/preserva id, createdAt e updatedAt.
4. saveLocalRecord abre transação SQLite.
5. A função insere/atualiza records com sync_status pending.
6. Na mesma transação, enqueue insere/atualiza a linha correspondente em outbox.
7. A lista é atualizada lendo records. Portanto o item aparece sem esperar rede.
8. Se não houver conexão, a fila permanece no aparelho; a faixa superior informa estado offline e a tela mostra o item pendente.
9. Se houver conexão, o listener, a reabertura do app ou o botão chama a sincronização.
10. Depois de confirmação do Firestore, acknowledgePending remove aquela versão da fila e marca o registro como synced se não existir outra alteração pendente.

Mesmo quando a pessoa está online, a ordem é local primeiro, nuvem depois. A tela não precisa fazer duas gravações diferentes para os casos online e offline.

### 3.5 Como a sincronização funciona

App.tsx chama synchronize(cloud, uid), que está em src/sync.ts. A função trabalha para as três entidades, projects, glossaries e terms, nesta ordem:

**Fase A — pull, da nuvem para o aparelho**

1. getDocs lê a subcoleção da entidade no caminho do UID autenticado.
2. Cada documento recebido é enviado a mergeRemoteRecords.
3. mergeRemoteRecords consulta se já existe uma mutação local pendente para aquele id.
4. Se houver, mantém a versão local para não apagar uma edição feita offline.
5. Se não houver, insere ou atualiza records como synced.
6. A lista do app exclui linhas com deletedAt preenchido, então tombstones recebidas não reaparecem como registros ativos.

**Fase B — push, do aparelho para a nuvem**

1. getPending busca até 100 operações em ordem de criação.
2. Para cada uma, sync.ts monta users/{uid}/{entidade}/{id}.
3. setDoc grava o registro inteiro e inclui userId: uid.
4. Somente depois de setDoc resolver sem erro a operação é reconhecida localmente.
5. Se uma gravação falhar, a exceção interrompe a rotina; itens não confirmados continuam na outbox.
6. synchronize devolve os números lidos, enviados e ainda pendentes.

setDoc usa o id fixo do registro no caminho, então reenviar a mesma operação escreve no mesmo documento. Isso torna a repetição da operação idempotente quanto ao destino. O app ainda mantém a fila até receber a confirmação de sucesso.

### 3.6 Exclusão sincronizável

A interface confirma a exclusão e chama deleteLocalRecord. Essa função não remove fisicamente a linha local: define deletedAt e atualiza updatedAt. A linha some da consulta de registros ativos, mas a mudança permanece na outbox e pode chegar ao Firestore como tombstone.

Isso permite que outro aparelho receba a informação de que o registro foi excluído. O Firestore conserva o documento com deletedAt preenchido; o app não usa deleteDoc no fluxo normal.

### 3.7 Como conflitos são tratados

A política do projeto é intencionalmente simples:

- Se há edição local pendente do mesmo id, o pull mantém essa versão e depois o push tenta enviá-la.
- Se não há pendência local, a versão remota substitui a cópia local.
- Não existe merge de campos, resolução de conflito com escolha do usuário, log de versões ou colaboração em tempo real.

Uma resposta honesta ao professor é: “A pendência local tem prioridade naquele registro para não perder a edição offline. Sem pendência, aplicamos o documento remoto. É uma estratégia simples, adequada ao escopo do trabalho, mas não é um sistema colaborativo com resolução avançada.”

### 3.8 Segurança: login, caminho e regras

Um documento remoto tem este formato:

    users/UID/projects/ID_DO_REGISTRO
      id: ID_DO_REGISTRO
      userId: UID
      name: nome do projeto
      createdAt: data ISO
      updatedAt: data ISO
      deletedAt: null ou data ISO

firestore.rules verifica se há usuário autenticado, se o UID autenticado é o mesmo do caminho e se id/userId correspondem ao documento. Isso protege o acesso por proprietário. A regra atual não valida todos os campos nem restringe o nome da subcoleção a uma lista fechada; o guia de apresentação registra essa limitação.

A configuração EXPO_PUBLIC_FIREBASE_* fica no bundle do cliente por necessidade do SDK. Ela identifica o projeto, mas não é uma credencial administrativa. Não se deve incluir chave privada de conta de serviço. A autorização dos documentos é feita com Authentication e Security Rules.

## 4. Explicação arquivo por arquivo

### Inicialização e telas

#### index.ts

É a entrada padrão do Expo. registerRootComponent registra App no runtime, seja no Expo Go ou em um build nativo. A lógica de produto não deve ser colocada aqui.

#### App.tsx

É o componente raiz e o coordenador de sessão, abas, estado da conexão e sincronização.

- Account guarda uid, email e se a sessão é demonstração.
- authReady impede que a tela de login apareça antes de recuperar uma sessão persistida.
- tab escolhe Projetos, Glossários, Termos ou OPUS.
- syncState e syncMessage controlam a faixa de status, erros e confirmação.
- refreshKey faz a tela de registros reler o SQLite depois de uma sincronização ou mudança.
- syncing é um ref usado como trava para não iniciar duas sincronizações simultâneas.
- O efeito com onAuthStateChanged atualiza a conta quando o Firebase informa login, logout ou sessão recuperada.
- runSync verifica conta não-demo, instância Firestore, trava e estado de rede; depois chama synchronize e traduz resultado em mensagem para a interface.
- Outro efeito tenta sincronizar ao entrar na conta, quando a rede volta e quando o app retorna ao primeiro plano. Também remove os listeners ao sair daquela sessão.
- openDemo carrega exemplos locais uma vez, identificados por demo-local.
- exitAccount sai do modo demonstração local ou chama signOut para a sessão Firebase.
- A renderização mostra AuthScreen sem conta; com conta, mostra o cabeçalho, botão de sincronização, tela da aba e navegação inferior.

É importante não atribuir toda sincronização a um único “modo automático”: há tentativa por eventos do sistema, mas também existe o botão manual. Uma tentativa pode ainda deixar pendências, como quando há mais de 100 operações.

#### src/firebase.ts

Centraliza a criação do cliente Firebase. Lê as cinco variáveis públicas EXPO_PUBLIC_FIREBASE_*. firebaseConfigured indica se todas estão preenchidas.

Se a configuração estiver incompleta, auth e cloud continuam null; a aplicação ainda pode abrir a demonstração local. Com configuração presente, o arquivo reutiliza ou inicializa o Firebase App, inicializa Auth com persistência React Native em AsyncStorage e cria a instância Firestore.

AsyncStorage guarda a sessão do Firebase Authentication. Não é onde os projetos, glossários e termos são guardados; esses dados estruturados ficam no SQLite.

#### src/firebase-auth-rn.d.ts

Declaração de tipos TypeScript para getReactNativePersistence, que o Firebase Auth para React Native exporta por um ponto que pode não estar representado nos tipos usados pelo projeto. Não executa lógica de autenticação por si só.

#### src/screens/AuthScreen.tsx

Desenha o formulário de entrar/criar conta e o botão de demonstração local.

- createAccount seleciona cadastro ou login.
- submit valida presença de e-mail e tamanho mínimo da senha, verifica que existe auth e chama createUserWithEmailAndPassword ou signInWithEmailAndPassword.
- O Firebase Auth confirma as credenciais; o observador em App.tsx recebe a nova sessão.
- Erros conhecidos são convertidos para mensagens compreensíveis.
- O botão de demonstração chama a função do App, sem criar conta.

A tela não grava a senha em SQLite ou Firestore.

#### src/screens/CrudScreen.tsx

Uma tela reutilizada para os três CRUDs. Recebe EntityDefinition, ownerId e callbacks; por isso não duplica formulário e regras básicas para cada entidade.

- refresh chama listRecords no SQLite e controla loading/erro.
- openCreate prepara campos vazios conforme a definição.
- openEdit transforma o registro existente em campos de formulário.
- closeForm evita descartar silenciosamente o que foi digitado.
- save chama validateDraft, makeId quando é novo, toRecord e saveLocalRecord. Após persistir, fecha o formulário, atualiza a lista e sinaliza mudança ao App.
- remove pede confirmação, chama deleteLocalRecord e atualiza a lista.
- O rótulo de cada cartão vem de syncStatus: sincronizado, pendente ou somente aparelho em modo local.
- Modal contém o formulário; Button, Field, Card, Notice e SectionTitle vêm dos componentes reutilizáveis.

Note que CrudScreen chama database.ts, não o SDK Firestore. Essa separação é a chave para o modo offline-first.

#### src/screens/OpusScreen.tsx

Interface da integração de memória de tradução. Ela separa três atividades:

1. Pesquisar frase online com MyMemory.
2. Pesquisar localmente amostras TMX já importadas.
3. Consultar catálogo OPUS e importar amostra para o SQLite.

Os estados catalogBusy, lookupBusy e importing evitam confundir carregamento com resultado. A frase enviada ao MyMemory é limitada e só é enviada após toque explícito. A pesquisa local chama searchLocalTm e não precisa de rede. importDataset chama importOpusSample com o teto de 1.000 pares e recarrega a lista de amostras.

### Dados, regras e validação

#### src/types.ts

Define tipos TypeScript comuns: EntityType, DataRecord, StoredRecord, PendingMutation, FieldDefinition e EntityDefinition. Ajuda o compilador a detectar incompatibilidades entre a tela, SQLite e sincronização. Os tipos TypeScript não validam dados em runtime nem substituem Security Rules.

#### src/definitions.ts

Declara, para cada tipo, título, campos do formulário, campos obrigatórios apresentados, rótulo principal e detalhes exibidos. CrudScreen recebe uma dessas configurações para montar a interface dos Projetos, Glossários ou Termos.

#### src/validation.ts

Contém funções sem dependência de interface:

- validateDraft aplica obrigatoriedade por entidade, lista permitida de idiomas, impede origem igual ao destino, limita tamanhos e valida o formato de referências com esquema.
- toRecord remove espaços extras e mantém createdAt quando edita; atualiza updatedAt; mantém id e reinicia deletedAt como null.
- recordToDraft tira metadados técnicos para preencher o formulário de edição.

Esta validação melhora os dados aceitos pela interface, mas não valida dados enviados por clientes modificados diretamente. Por isso Firestore ainda precisa de regras.

#### src/database.ts

É a camada de persistência local. Centraliza acesso Expo SQLite e as operações usadas pelas telas e sincronização.

- database mantém uma Promise compartilhada para abrir/criar o banco apenas uma vez. Configura WAL, chaves estrangeiras, tabelas e índices.
- listRecords consulta registros por ownerId e entidade, esconde tombstones e ordena pela atualização.
- ensureDemoData consulta app_metadata e insere exemplos apenas quando ainda não há dados daquele modo.
- saveLocalRecord grava/atualiza records e chama enqueue dentro da mesma transação.
- deleteLocalRecord converte exclusão em soft delete e reutiliza saveLocalRecord.
- enqueue usa chave única owner/entidade/id para manter uma operação atual por registro.
- getPending retorna até 100 operações em ordem.
- acknowledgePending remove apenas a versão da operação que foi confirmada e marca synced se nenhuma outra versão ainda estiver na fila.
- mergeRemoteRecords ignora ids com pendência local e aplica o resto como synced.
- makeId cria UUID para novo registro.
- listTmxDatasets lista metadados de amostras OPUS.
- saveTmxSample substitui a amostra selecionada dentro de transação.
- searchLocalTm normaliza caixa e acentos e busca segmentos contendo a frase, limitada a oito resultados.

Os índices aceleram as consultas mais frequentes. As tabelas tm_datasets/tm_pairs são independentes dos registros de conta; o código não as envia para o Firestore.

#### src/sync.ts

Contém a operação de sincronização fora das telas. synchronize recebe instância Firestore e UID. Primeiro lê as três subcoleções e mescla no SQLite; depois processa uma página da outbox com setDoc. Cada sucesso é reconhecido no SQLite. A função devolve contagens para App.tsx exibir o resultado.

#### firestore.rules e firebase.json

firestore.rules define as permissões no servidor Firebase. firebase.json aponta o Firebase CLI para esse arquivo quando publica regras. As regras não ficam ativas apenas por existirem no Git: precisam ser publicadas no projeto Firebase.

### OPUS, TMX e componentes visuais

#### src/opus.ts

Concentra comunicação HTTP:

- searchOpusCatalog consulta a API OPUS com idiomas, preprocessing TMX, versão e coleção opcional; valida URLs devolvidas e limita resultados mostrados pela tela.
- searchMyMemory faz a consulta online de frase e mapeia somente resultados úteis para o formato da interface.
- allowedOpusUrl aceita apenas HTTPS e hosts OPUS previstos; a URL após redirecionamento também é conferida.
- importOpusSample lê o download em fluxo, limita bytes comprimidos e descompactados, detecta GZIP/ZIP, envia XML ao parser, para após a quantidade máxima de pares e salva a amostra no SQLite.

Importar amostra e abrir arquivo TMX são ações diferentes: a primeira é limitada e salva localmente; a segunda abre o arquivo integral no navegador.

#### src/tmx-parser.ts

createTmxCollector cria um parser XML incremental usando saxes. Não precisa carregar o XML inteiro numa árvore na memória.

- A pilha acompanha a posição de elementos para aceitar tu dentro de body, tuv dentro de tu e seg dentro de tuv.
- xml:lang identifica o idioma de cada variante.
- languageMatch aceita idioma exato e, quando se pede o código genérico, permite variante regional.
- Texto de segmentos vira pares depois de fechar uma unidade tu, desde que exista uma origem e um destino válidos.
- Entidades XML são decodificadas pelo parser; placeholders inline são omitidos.
- DTD interna, XML malformado, unidades e segmentos grandes, profundidade excessiva e número excessivo de variantes são recusados.
- done informa quando o limite de pares foi atingido.

#### src/components/UI.tsx

Contém primitivas de apresentação reutilizadas: Card, Button, Field, Eyebrow, Notice e SectionTitle. Aqui ficam também rótulos de acessibilidade e estilos de erro dos campos. Não contém regra de Firebase nem de banco.

#### src/theme.ts

Centraliza paleta, espaçamentos, raios e tamanhos de texto para manter as telas visualmente consistentes.

#### src/demo-data.ts

Cria registros fictícios para a demonstração local. Não inclui dados reais de clientes e não autentica nem envia exemplos para a nuvem.

### Testes, configuração e arquivos de apoio

#### tests/validation.test.ts

Testa campos obrigatórios, idiomas, metadados de criação/edição e validação das fontes.

#### tests/tmx-parser.test.ts

Testa extração de pares, entidades XML, preferência por idioma regional exato, teto máximo de pares, remoção de placeholders e recusa de XML inválido/DTD interna.

O repositório não tem testes automatizados de ponta a ponta com Firebase Emulator ou de interação em aparelho. A integração cloud/offline deve ser verificada no ensaio manual descrito no guia de apresentação.

#### package.json e package-lock.json

package.json declara dependências e comandos npm. package-lock.json fixa as versões resolvidas para npm ci. Expo e React Native formam a plataforma; expo-sqlite fornece SQLite; Firebase SDK implementa Auth/Firestore; AsyncStorage persiste a sessão; expo-network observa conectividade; fflate descompacta; saxes interpreta TMX; expo-crypto cria UUID.

#### app.json

Configura nome, slug, orientação, ícones, identificador Android, suporte a tablet e plugin Expo SQLite. É configuração de app Expo, não a configuração de projeto Firebase.

#### .env.example e .env

.env.example mostra os nomes das cinco variáveis necessárias sem valores. .env local guarda a configuração cliente do Firebase e é ignorado pelo Git. Cada integrante que clonar o projeto precisa criar seu próprio .env e reiniciar o Expo. Não compartilhar arquivo com credenciais administrativas.

#### DESIGN.md, UX-CONTRACT.md, README.md e assets

- DESIGN.md registra identidade visual e tokens.
- UX-CONTRACT.md registra decisões de interação, acessibilidade, isolamento local e estados offline.
- README.md explica instalação, Firebase e demonstração.
- assets contém ícones e imagens de splash usados pela configuração Expo.
- dist, .expo e node_modules são saídas/cache/dependências locais; não são código-fonte para editar ou publicar como parte normal do app.

## 5. Três histórias completas que podem ser explicadas no quadro

### História A — novo termo enquanto online

1. A sessão Auth fornece UID.
2. App escolhe a aba Termos e passa UID a CrudScreen.
3. Definitions cria os campos; Validation rejeita campos obrigatórios ausentes.
4. O botão Salvar chama saveLocalRecord.
5. SQLite grava records e outbox na mesma transação.
6. O item é imediatamente mostrado do SQLite como pendente.
7. O botão Sincronizar ou o listener chama synchronize.
8. sync.ts executa setDoc em users/UID/terms/ID e acrescenta userId.
9. As regras verificam usuário, caminho, userId e id.
10. Após sucesso, acknowledgePending remove a operação local e o estado fica synced.

### História B — editar sem internet

1. A tela continua lendo e escrevendo SQLite.
2. saveLocalRecord atualiza records e deixa a operação em outbox.
3. A interface mostra pendência/offline; não apaga o texto salvo.
4. Ao detectar rede, App tenta sincronizar.
5. Pull não substitui o mesmo id local enquanto a fila o marca pendente.
6. Push envia a última versão da outbox.
7. A confirmação remove a pendência e a lista é atualizada.

Se o envio falhar, a operação não confirmada permanece. Se houver mais de 100 pendências, o lote atual pode deixar o restante aguardando outra tentativa.

### História C — importar uma amostra do OPUS

1. A tela manda o par de idiomas e coleção a searchOpusCatalog.
2. A API devolve itens, incluindo URL; o app aceita apenas hosts permitidos.
3. O usuário escolhe Importar amostra para uso offline.
4. A resposta HTTP é consumida em fluxo e pode ser descompactada.
5. createTmxCollector interpreta unidades e seleciona variantes de idioma.
6. Ao atingir o limite, o download é cancelado.
7. saveTmxSample grava os pares e metadados no SQLite.
8. Uma pesquisa local consulta SQLite e funciona sem rede.

## 6. Respostas orais para perguntas prováveis

### “Como vocês unificaram o Firebase com o banco interno?”

“Criamos uma camada local no SQLite e uma outbox. A tela nunca depende do Firestore para salvar: grava o registro e uma pendência local na mesma transação. O UID do Firebase identifica o dono e forma o caminho da nuvem. Uma função separada faz pull dos documentos e push da outbox. Só marcamos como sincronizado quando setDoc confirma. Assim usamos o mesmo registro, identificado pelo id, nos dois bancos e não perdemos uma edição por falta de rede.”

### “O Firestore não faz isso offline sozinho?”

“O SDK Firestore tem recursos próprios de cache em algumas plataformas, mas o nosso fluxo usa SQLite explícito com Expo e sincronização própria. A tela lê o SQLite, e nós controlamos fila, status, tombstone e momento do envio. Não dependemos do cache implícito do SDK.”

### “Como o app sabe qual usuário é dono?”

“Firebase Authentication fornece user.uid. Passamos esse valor como ownerId ao banco local e usamos users/{uid}/... no Firestore. As regras conferem o UID do token contra o UID no caminho e os campos userId/id.”

### “Por que salvar primeiro local?”

“A gravação fica disponível imediatamente e funciona sem conexão. A outbox torna explícito o que ainda falta enviar. Se a rede falhar, não precisamos reconstruir a alteração a partir de um formulário aberto.”

### “O que acontece se sincronizar duas vezes?”

“A operação usa o mesmo id e o mesmo caminho de documento com setDoc, então a repetição sobrescreve o mesmo documento em vez de criar cópias. Só removemos a pendência após resposta de sucesso.”

### “E se dois aparelhos editarem o mesmo registro?”

“O app não faz merge de campos. Uma edição pendente local preserva prioridade durante o pull e será enviada; se não houver pendência, a versão remota atualiza a cópia. É uma regra simples e reconhecemos que não substitui controle de versões colaborativo.”

### “O que é tombstone?”

“É um marcador de exclusão. Mantemos o documento com deletedAt preenchido, escondemos da lista e sincronizamos essa marca. Assim outro aparelho pode aprender que o item foi excluído sem precisar apagar a evidência da fila.”

### “A senha está no SQLite?”

“Não. O Firebase Authentication trata a senha. O app persiste a sessão do SDK com AsyncStorage. O SQLite guarda os dados de trabalho e a fila.”

### “A chave que está no .env é segredo?”

“A configuração EXPO_PUBLIC do app identifica o projeto Firebase no cliente. Não é uma chave administrativa. As permissões dependem da sessão e das regras. Chaves privadas de conta de serviço não podem entrar no app.”

### “Como provam que está no Firestore?”

“Depois de sincronizar, mostramos o caminho users/{uid}/projects, users/{uid}/glossaries ou users/{uid}/terms no Console Firebase. Na tela, o estado muda para Na nuvem. O ensaio real complementa os testes unitários.”

### “O que está coberto pelos testes?”

“Os testes unitários exercitam validação de formulários e parsing TMX. TypeScript verifica tipos e a exportação Android verifica o empacotamento. Não temos teste de ponta a ponta com Firebase Emulator; demonstramos Auth, Firestore e modo offline no aparelho.”

## 7. O que decorar e o que entender

Cada integrante deve conseguir apontar estes arquivos no repositório:

| Conceito da pergunta | Arquivo para abrir |
|---|---|
| Sessão, tela principal e estado de rede | App.tsx |
| Login e cadastro | src/screens/AuthScreen.tsx |
| Configuração e persistência Auth | src/firebase.ts |
| Formulário e operações CRUD | src/screens/CrudScreen.tsx |
| Campos por entidade | src/definitions.ts |
| Validação e criação de registro | src/validation.ts |
| SQLite, outbox e tombstone | src/database.ts |
| Pull/push Firestore | src/sync.ts |
| Segurança no servidor | firestore.rules |
| OPUS e MyMemory | src/opus.ts |
| XML TMX | src/tmx-parser.ts |
| Componentes visuais | src/components/UI.tsx |

O melhor treino é uma pessoa escolher uma ação e outra seguir a cadeia pelos arquivos. Por exemplo: “editar um termo offline” deve levar do formulário em CrudScreen, pela validação, ao saveLocalRecord, à outbox e finalmente ao push em sync.ts quando a conexão volta.
