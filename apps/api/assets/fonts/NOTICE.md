# Fuentes

`LiberationSans-*.ttf` proceden del paquete npm [`@typopro/dtp-liberation`](https://github.com/rse/typopro)
(v3.7.5), que redistribuye las fuentes *Liberation* de Red Hat.

- **Licencia**: SIL Open Font License 1.1 (y MIT/Apache-2.0/CC0 según el paquete).
- **Por qué**: Liberation Sans es métricamente compatible con **Arial/Helvetica**, que es la
  tipografía del diseño original “brat”. Al incrustarlas, el render es idéntico en local,
  en Vercel y en cualquier contenedor Linux sin fuentes instaladas.

Estos archivos se recopian automáticamente en el `postinstall`
(`apps/api/scripts/copy-fonts.mjs`); se versionan además como respaldo para despliegues
donde no se ejecuten los scripts de instalación.
