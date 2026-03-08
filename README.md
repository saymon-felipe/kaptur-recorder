# Kadem Recorder

**Kadem Recorder** é uma extensão para o Chrome que permite gravar vídeos de forma simples e intuitiva. Com ela, você pode capturar a tela, a webcam e o áudio, editar clipes e salvar ou enviar os vídeos para o Google Drive. A extensão foi desenvolvida para facilitar a criação e o gerenciamento de gravações de vídeo.

---

## 📌 Funcionalidades

- **🎥 Gravação de Tela e Webcam:**  
  Grave a tela do seu navegador ou capture vídeos diretamente da webcam, com suporte para gravação simultânea de áudio.

- **✂️ Edição e Corte de Vídeos:**  
  Recorte os vídeos gravados definindo os pontos de início e fim, com uma interface interativa que mostra a pré-visualização e o tempo decorrido.

- **⚡ Transcodificação:**  
  Converta os vídeos gravados para os formatos **MP4** ou **WebM** utilizando o **FFmpeg** compilado em WebAssembly, garantindo uma conversão rápida e eficiente.

- **☁️ Exportação e Upload para o Google Drive:**  
  Baixe os vídeos diretamente ou envie-os para uma pasta dedicada no Google Drive. A autenticação é realizada via **OAuth2**, garantindo segurança e facilidade no upload.

- **🖥️ Interface Intuitiva:**  
  A extensão possui uma interface moderna e responsiva, com **controles arrastáveis, feedback em tempo real** (logs, timers e contagens regressivas) e integração com **FontAwesome** para ícones.

---

## 🔧 Instalação no Chrome (MODO DESENVOLVEDOR)

Siga os passos abaixo para instalar a extensão no seu navegador Chrome:

### 1️⃣ Clone o Repositório

```bash
  git clone https://github.com/seu-usuario/kadem-recorder.git
  cd kadem-recorder
```

### 2️⃣ Acesse a Página de Extensões do Chrome

- Digite `chrome://extensions/` na barra de endereço do Chrome.
- Ative o **Modo de Desenvolvedor** no canto superior direito.

### 3️⃣ Carregue a Extensão

- Clique em **"Carregar sem compactação"**.
- Selecione a pasta do projeto `kadem-recorder`.

### 4️⃣ Configuração OAuth2

- Certifique-se de que o arquivo `manifest.json` possua as configurações corretas de OAuth2 para a autenticação com o Google Drive.
- Caso necessário, ajuste o `client_id` conforme orientado pela [documentação do Chrome Identity](https://developer.chrome.com/docs/extensions/reference/identity/).

---

## 🚀 Como Usar

### ▶️ Iniciar a Gravação

1. Clique no **ícone da extensão** na barra de ferramentas do Chrome.
2. Escolha entre **gravar a tela** ou **a webcam**.
3. Configure as opções de **áudio e vídeo** conforme desejado.
4. Clique em **Iniciar Gravação**.

### ✂️ Edição

1. Após a gravação, uma **interface interativa** será exibida para pré-visualizar o vídeo.
2. Utilize os **controles deslizantes** para definir os pontos de início e fim.
3. Clique em **Cortar** para processar a edição do vídeo.

### 📤 Exportação

- **Para salvar localmente:** clique em **Baixar**.
- **Para enviar ao Google Drive:** clique em **Salvar no Drive**.

### 🎛️ Feedback Visual

- Durante a gravação, controles intuitivos permitem **pausar, retomar e finalizar** a gravação.
- Logs e contadores exibem o **progresso da gravação e transcodificação**.

---

## 🛠️ Tecnologias Utilizadas

- **JavaScript (ES6+)** → Linguagem principal utilizada para o desenvolvimento da extensão.
- **Chrome Extensions API** → Para integração e comunicação entre os componentes da extensão.
- **FFmpeg em WebAssembly (WASM)** → Para transcodificação e corte dos vídeos.
- **Google Drive API** → Para upload e gerenciamento dos arquivos na nuvem.
- **OAuth2 com Chrome Identity API** → Para autenticação segura com o Google Drive.
- **HTML/CSS** → Para construção da interface do usuário, com suporte a **FontAwesome** para ícones.

---

## 👨‍💻 Desenvolvedor

**Saymon Felipe**  
*Software Engineer*

📧 Entre em contato para sugestões, feedback ou contribuições ao projeto.

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Se você deseja melhorar a extensão ou corrigir algum problema, siga estes passos:

1. **Faça um fork** do repositório.
2. **Crie uma branch** para sua feature:
   ```bash
   git checkout -b minha-nova-feature
   ```
3. **Faça commit** das suas alterações:
   ```bash
   git commit -am 'Adiciona nova feature'
   ```
4. **Envie sua branch** para o repositório remoto:
   ```bash
   git push origin minha-nova-feature
   ```
5. **Abra um Pull Request** 🚀

---

## 📜 Licença

Distribuído sob a licença **MIT**. Veja o arquivo [`LICENSE`](LICENSE) para mais detalhes.

---

## ❗ Observações

Esta extensão foi criada para facilitar a criação, edição e gerenciamento de vídeos, integrando funcionalidades robustas em um ambiente fácil de usar. Se você encontrar algum problema ou tiver sugestões para melhorias, por favor, **abra uma issue** no repositório.

---

## 🎬 Aproveite e boas gravações!
