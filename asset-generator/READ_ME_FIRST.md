# asset-generator 처음 사용법 (macOS + VS Code)

이 문서는 개발 경험이 없는 디자이너를 위한 안내서입니다. 아래 순서대로
한 번만 설치하면, 그 다음부터는 `START.command`만 더블클릭해도 됩니다.

## 0. 압축 풀고 VS Code에서 열기

1. 받은 ZIP 파일을 더블클릭해 압축을 풉니다.
2. VS Code를 실행합니다.
3. 상단 메뉴에서 `File` → `Open Folder...`를 누릅니다.
4. 압축을 풀어서 생긴 **asset-generator 폴더 자체**를 선택합니다.
5. VS Code 상단 메뉴에서 `Terminal` → `New Terminal`을 누릅니다.

화면 아래쪽에 글자를 입력할 수 있는 터미널이 열리면 준비가 된 것입니다.
아래의 검은 박스 안 명령어는 **한 줄씩 복사해 터미널에 붙여넣고 Enter**를
누르세요. `$` 표시는 입력하지 않습니다.

## 1. uv 설치

터미널에 아래를 입력합니다.

```sh
uv --version
```

버전 숫자가 나오면 이미 설치된 것이므로 `2. Codex CLI 설치`로 넘어가세요.
`command not found: uv`가 나오면 아래 명령으로 설치합니다.

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
```

설치가 끝나면 VS Code를 완전히 닫았다가 다시 열고, 같은 `asset-generator` 폴더를
다시 엽니다. 새 터미널에서 다시 확인합니다.

```sh
uv --version
```

공식 uv 설치 안내: <https://docs.astral.sh/uv/getting-started/installation/>

## 2. Codex CLI 설치

먼저 Node.js가 있는지 확인합니다.

```sh
node --version
```

버전 숫자가 나오면 다음 단계로 넘어가세요. `command not found: node`가 나오면
<https://nodejs.org/> 에서 **LTS** 버전을 받아 설치합니다. 설치 후 VS Code를 완전히
닫았다가 다시 열어주세요.

새 터미널에 아래 명령을 입력해 Codex CLI를 설치합니다.

```sh
npm install -g @openai/codex
```

설치 확인:

```sh
codex --version
```

버전 숫자가 나오면 설치 완료입니다.

OpenAI 공식 Codex CLI 안내: <https://help.openai.com/en/articles/11096431>

## 3. Codex에 ChatGPT 계정으로 로그인

터미널에 아래를 입력합니다.

```sh
codex --login
```

1. 브라우저에 로그인 화면이 열립니다.
2. 이미 사용하는 ChatGPT 계정으로 로그인합니다.
3. `Sign in with ChatGPT` 또는 연결 확인 버튼을 누릅니다.
4. 완료 메시지가 나오면 브라우저 탭을 닫아도 됩니다.

로그인 정보는 해당 Mac에만 저장됩니다. 압축 폴더에 계정 정보나 비밀번호를
적어넣지 마세요.

OpenAI 공식 로그인 안내:
<https://help.openai.com/en/articles/11381614-api-codex-cli-and-sign-in-with-chatgpt>

## 4. asset-generator 실행

VS Code 터미널에서 아래 명령을 입력합니다.

```sh
uv run app.py
```

처음 실행할 때는 Python과 필요한 파일을 자동으로 받으므로 몇 분 걸릴 수 있습니다.
터미널을 닫지 말고 기다리세요.

브라우저가 자동으로 열리지 않으면 Safari나 Chrome에서 아래 주소를 엽니다.

<http://localhost:8111>

설치가 끝난 뒤부터는 Finder에서 `START.command`를 더블클릭해 실행해도 됩니다.
macOS가 처음 실행을 막으면 `START.command`를 우클릭하고 `열기`를 누르세요.

## 5. 배경 만들기

1. 화면 상단의 `새로 만들기`를 누릅니다.
2. 카테고리에서 `배경`을 선택합니다.
3. `에셋 id`를 영문 소문자와 밑줄로 적습니다. 예: `night_office`
4. `설명`에 원하는 장소의 모습을 적습니다.
5. `배경 만들기`를 누릅니다.
6. `완료`가 나올 때까지 터미널과 브라우저를 닫지 마세요.

설명 예시:

> 밤의 좁은 사무실. 빈 책상이 줄지어 있고 차가운 천장 조명과 어두운 창문이
> 뒤쪽에 보이는 모습.

기본 결과는 256x256, 32색 픽셀 배경입니다. 크기나 색 수를 바꾸고 싶을 때만
`고급 설정`을 사용하세요.

## 6. 결과 확인·수정

- `라이브러리`에서 만든 에셋을 다시 볼 수 있습니다.
- `재생성`: 같은 설명으로 새로 다시 그립니다.
- `수정`: 현재 그림을 기준으로 원하는 부분만 바꿉니다.
- `픽셀화 다시`: 이미지를 새로 그리지 않고 픽셀 변환만 다시 합니다.
- `후보`: 이전에 만든 결과로 되돌릴 수 있습니다.

이미지 생성은 인터넷 연결과 Codex 사용량을 사용합니다. 완료되기 전에 터미널을
닫지 마세요.

## 7. 파일 찾기

VS Code 왼쪽 파일 목록에서 아래 폴더를 펼치면 됩니다.

- 작업 중 이미지와 이전 버전: `assets`
- 각 배경의 픽셀 PNG: `assets/background/<에셋 id>/pixel/`
- 빌드한 최종 배경 PNG: `dist/backgrounds`
- 빌드한 타일 PNG: `dist/tiles`
- 스프라이트 아틀라스: `dist/atlas.png`

전체 결과를 빌드하려면 화면 상단의 `빌드`로 이동해 `아틀라스 빌드`를 누릅니다.

## 8. 종료하기

VS Code 터미널을 클릭하고 `Control + C`를 누릅니다. `START.command`로 실행했다면
그 터미널 창을 닫으면 됩니다.

`assets` 폴더와 `dist` 폴더를 지우면 작업 결과가 사라지니 주의하세요.

## 문제가 생겼을 때

- `command not found: uv`: 1번 단계를 다시 확인하고 VS Code를 재시작합니다.
- `command not found: codex`: 2번 단계를 다시 확인하고 VS Code를 재시작합니다.
- 로그인 화면이 나오는 경우: `codex --login`을 다시 실행합니다.
- `Address already in use` 또는 8111 포트 오류: 이전에 열어둔 asset-generator
  터미널을 닫고 다시 실행합니다.
- 생성 중 오류: 오류 메시지를 캡처해 담당 개발자에게 전달합니다.
