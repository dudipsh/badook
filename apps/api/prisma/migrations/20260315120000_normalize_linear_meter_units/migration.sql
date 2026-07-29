-- Normalize all linear meter unit variants to canonical 'מטר אורך'
UPDATE line_items SET unit = 'מטר אורך' WHERE unit IN ('מטר', 'מ"א', 'מא', 'מ''א');
UPDATE po_line_items SET unit = 'מטר אורך' WHERE unit IN ('מטר', 'מ"א', 'מא', 'מ''א');
UPDATE invoice_line_items SET unit = 'מטר אורך' WHERE unit IN ('מטר', 'מ"א', 'מא', 'מ''א');
