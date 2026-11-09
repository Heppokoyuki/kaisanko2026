# rule.md を pfpdf (default テンプレート) で PDF に組版する
#   make        rule.md が更新されていれば rule.pdf を再生成
#   make watch  rule.md の保存を監視して自動で再生成 (Ctrl+C で終了)
#   make clean  rule.pdf を削除

PFPDF := pfpdf/dist/launcher.js

.PHONY: all watch clean

all: rule.pdf

rule.pdf: rule.md $(PFPDF)
	node $(PFPDF) --input $< --output $@

# pfpdf が未ビルドなら依存を入れてビルドする
$(PFPDF):
	cd pfpdf && npm ci --no-audit --no-fund && npm run build

watch: rule.pdf
	@echo "rule.md を監視中 (Ctrl+C で終了)"
	@while true; do $(MAKE) --no-print-directory -q rule.pdf || $(MAKE) --no-print-directory rule.pdf; sleep 1; done

clean:
	rm -f rule.pdf
