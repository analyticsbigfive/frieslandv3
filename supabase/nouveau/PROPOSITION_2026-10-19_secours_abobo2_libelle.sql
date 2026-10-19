-- PROPOSITION 2026-10-19 : accents du secours ABOBO 2 de Seregone
-- Le script PROPOSITION_2026-10-19_secours_abobo2_seregone.sql est passé par un presse-papiers
-- mal encodé : le nom de la règle et le motif de l'exception DMS NIARE sont arrivés en
-- « p√©rim√®tre ‚Äî ». Les données (1 385 PDV, exception, tournées) sont justes ; seuls ces
-- deux textes sont corrigés. Le nom compte aussi pour le garde-fou du script : avec le nom
-- abîmé, un nouveau collage créerait une 2e règle.

update routing_templates
set label = 'Portefeuille périmètre — ABOBO 2'
where id = 'efdd38e8-ee35-4097-8f76-39690597dd7d'
  and user_id = 'c4f8d184-718a-4f45-8ac1-1e2a90e20da3';

update routing_template_exception
set motif = 'Ancien portefeuille DMS de Yao (ABOBO 1) : remplacé par « Portefeuille périmètre — ABOBO 2 » depuis la réaffectation du 16/10.'
where template_id = '9128ab2e-00cb-480a-8fca-d99fdb94e351'
  and pdv_id is null
  and date_debut = '2026-10-20';

select (select label from routing_templates where id = 'efdd38e8-ee35-4097-8f76-39690597dd7d') as regle,
       (select motif from routing_template_exception where template_id = '9128ab2e-00cb-480a-8fca-d99fdb94e351' and pdv_id is null) as exception;
