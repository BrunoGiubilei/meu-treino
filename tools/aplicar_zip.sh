#!/bin/bash
# Uso: ./aplicar_zip.sh arquivo.zip /caminho/do/projeto [--dry-run]

ZIP="$1"
PROJETO="${2%/}"
MODO="$3"

if [ -z "$ZIP" ] || [ -z "$PROJETO" ]; then
  echo "Uso: $0 arquivo.zip /caminho/do/projeto [--dry-run]"
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP" -d "$TMP" || exit 1

find "$TMP" -type f | while read -r src; do
  nome=$(basename "$src")
  mapfile -t alvos < <(find "$PROJETO" -type f -name "$nome" \
                         -not -path "*/.git/*" -not -path "*/node_modules/*")

  case ${#alvos[@]} in
    0)
      if [ "$MODO" = "--dry-run" ]; then
        echo "NOVO (precisaria de destino): $nome"
        continue
      fi
      read -r -p "Arquivo novo '$nome'. Pasta de destino (relativa a $PROJETO, vazio para pular): " destino </dev/tty
      if [ -z "$destino" ]; then
        echo "PULADO: $nome"
        continue
      fi
      mkdir -p "$PROJETO/$destino"
      cp "$src" "$PROJETO/$destino/$nome" && echo "OK: $nome -> $PROJETO/$destino/$nome"
      ;;
    1)
      if [ "$MODO" = "--dry-run" ]; then
        echo "COPIARIA: $nome -> ${alvos[0]}"
      else
        cp "$src" "${alvos[0]}" && echo "OK: $nome -> ${alvos[0]}"
      fi
      ;;
    *)
      echo "AMBÍGUO (existe em várias pastas, pulado): $nome"
      printf '   %s\n' "${alvos[@]}"
      ;;
  esac
done
