#!/bin/zsh

# Double-click this file in Finder to start asset-generator.

set -u

cd "${0:A:h}" || exit 1

pause_and_exit() {
  echo
  echo "$1"
  echo
  echo "이 창을 닫으면 종료됩니다."
  read -r "?Enter 키를 누르세요... "
  exit 1
}

if ! command -v uv >/dev/null 2>&1; then
  pause_and_exit "uv가 설치되어 있지 않습니다. 담당 개발자에게 'uv 설치'를 요청해 주세요."
fi

if ! command -v codex >/dev/null 2>&1; then
  pause_and_exit "Codex CLI가 설치되어 있지 않습니다. 담당 개발자에게 'Codex CLI 설치 및 로그인'을 요청해 주세요."
fi

echo "asset-generator를 시작합니다."
echo "처음 실행할 때는 필요한 파일을 받느라 잠시 걸릴 수 있습니다."
echo "이 창은 작업하는 동안 닫지 마세요."
echo

ASSET_GENERATOR_OPEN_BROWSER=1 uv run app.py

echo
echo "asset-generator가 종료됐습니다."
read -r "?Enter 키를 누르면 창이 닫힙니다... "
