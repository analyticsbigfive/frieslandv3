<template>
  <div class="min-h-screen bg-gray-50 px-6 py-12 dark:bg-gray-900">
    <main class="mx-auto max-w-2xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Politique de confidentialité — Bonnet Rouge</h1>
      <p class="mt-1 text-sm text-gray-400">Dernière mise à jour : 7 septembre 2026</p>

      <div class="mt-8 space-y-6 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Identification de l'application et de l'éditeur</h2>
          <p>
            La présente politique de confidentialité s'applique à l'application mobile
            <strong>Friesland Bonnet Rouge</strong> (nom court « Bonnet Rouge »), publiée sur Google Play
            sous l'identifiant de package <code class="text-[13px]">com.bdco.bonnetrouge</code>, ainsi qu'à
            sa version web.
          </p>
          <p class="mt-2">
            L'application est éditée et publiée par <strong>BD &amp; CO</strong>
            (BUSINESS DEVELOPMENT &amp; COMMUNICATION), société à responsabilité limitée de droit français
            immatriculée sous le numéro SIREN 528 724 362, dont l'adresse est
            60 rue François Ier, 75008 Paris, France. BD &amp; CO est le développeur de l'Application, le
            titulaire du compte de développeur Google Play sous lequel elle est publiée
            (nom du développeur : « BD &amp; CO ») et le responsable du traitement des données décrites
            ci-dessous.
          </p>
          <p class="mt-2">
            Site web de l'éditeur :
            <a href="https://bigfivesolutions.com/" class="text-fc-red underline" rel="noopener" target="_blank">bigfivesolutions.com</a>
            — contact développeur :
            <a href="mailto:team@bigfive-edition.com" class="text-fc-red underline">team@bigfive-edition.com</a>.
          </p>
        </section>

        <p>
          L'application <strong>Bonnet Rouge</strong> (« l'Application ») est un outil professionnel de collecte
          de données terrain destiné aux équipes commerciales et merchandising intervenant sur le réseau de
          points de vente en Côte d'Ivoire. Elle est réservée à un usage interne : l'accès nécessite un compte
          créé par l'administrateur.
        </p>

        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Données collectées</h2>
          <ul class="list-disc space-y-2 pl-5">
            <li>
              <strong>Données de compte</strong> : nom, adresse e-mail professionnelle, rôle et périmètre
              d'intervention (zones et secteurs), fournis lors de la création du compte.
            </li>
            <li>
              <strong>Données de visite</strong> : relevés saisis par l'utilisateur lors de ses visites en point
              de vente (disponibilité des produits, prix, visibilité, actions réalisées) et photos des points de
              vente prises via l'Application.
            </li>
            <li>
              <strong>Localisation (au premier plan)</strong> : la position GPS de l'appareil est relevée au
              moment de l'enregistrement d'une visite, afin de valider la présence sur le point de vente
              (géorepérage), et pour afficher la distance jusqu'au prochain point de vente.
            </li>
            <li>
              <strong>Localisation en arrière-plan (suivi de tournée)</strong> : lorsque l'utilisateur démarre
              explicitement une tournée, l'Application collecte sa position GPS à intervalles réguliers,
              <strong>y compris lorsque l'application est fermée ou n'est pas utilisée</strong>, afin de
              reconstituer le trajet et les visites de la journée dans le tableau de bord de son organisation.
              Cette collecte commence au bouton « Démarrer la tournée », s'arrête au bouton « Terminer la
              tournée », est signalée en permanence par une notification Android et n'est jamais activée sans
              action de l'utilisateur. Avant toute demande d'autorisation, l'Application affiche un écran
              d'explication que l'utilisateur doit accepter.
            </li>
          </ul>
        </section>

        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Utilisation des données</h2>
          <p>
            Les données servent exclusivement au pilotage de l'activité commerciale et merchandising : suivi des
            visites, tableaux de bord, contrôle de la couverture du réseau de points de vente. Elles ne sont ni
            vendues, ni louées, ni utilisées à des fins publicitaires, ni partagées avec des tiers en dehors de
            l'organisation cliente et de ses prestataires techniques.
          </p>
        </section>

        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Stockage et sécurité</h2>
          <p>
            Les données sont hébergées sur l'infrastructure Supabase (Union européenne), avec chiffrement en
            transit (HTTPS) et contrôle d'accès par compte authentifié. L'Application peut conserver
            temporairement des données sur l'appareil pour permettre le travail hors connexion ; elles sont
            synchronisées puis conservées côté serveur.
          </p>
        </section>

        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Conservation et suppression</h2>
          <p>
            Les données sont conservées pendant la durée de la relation contractuelle avec l'organisation
            cliente. Un utilisateur peut demander la consultation, la rectification ou la suppression de ses
            données personnelles en contactant l'éditeur à l'adresse ci-dessous ; les comptes désactivés n'ont
            plus accès à l'Application.
          </p>
          <p class="mt-2">
            <strong>Supprimer son compte</strong> : la demande de suppression du compte et des données associées
            se fait depuis la page
            <NuxtLink to="/suppression-de-compte" class="text-fc-red underline">Supprimer mon compte</NuxtLink>,
            accessible sans connexion. Elle est traitée par l'administrateur sous 30 jours.
          </p>
        </section>

        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Permissions de l'appareil</h2>
          <ul class="list-disc space-y-2 pl-5">
            <li>
              <strong>Localisation (pendant l'utilisation)</strong> : validation de la présence en point de
              vente lors d'une visite.
            </li>
            <li>
              <strong>Localisation « Toujours autoriser » (arrière-plan)</strong> : suivi GPS d'une tournée
              démarrée par l'utilisateur, écran éteint ou application fermée, jusqu'à la fin de la tournée.
            </li>
            <li>
              <strong>Désactivation de l'optimisation de batterie</strong> : permet au suivi de tournée de ne
              pas être interrompu par le système.
            </li>
            <li><strong>Appareil photo</strong> : prise de photos des points de vente et des relevés de visibilité.</li>
          </ul>
          <p class="mt-2">
            Chaque permission n'est utilisée qu'au moment où la fonctionnalité correspondante est déclenchée par
            l'utilisateur.
          </p>
        </section>

        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Contact</h2>
          <p>
            Responsable du traitement : <strong>BD &amp; CO</strong> (BUSINESS DEVELOPMENT &amp; COMMUNICATION)<br>
            60 rue François Ier, 75008 Paris, France<br>
            Éditeur :
            <a href="mailto:team@bigfive-edition.com" class="text-fc-red underline">team@bigfive-edition.com</a><br>
            Demandes relatives aux données et aux comptes :
            <a href="mailto:jeanluc@bigfiveabidjan.com" class="text-fc-red underline">jeanluc@bigfiveabidjan.com</a>
          </p>
        </section>
      </div>

      <p class="mt-10 flex flex-wrap justify-center gap-x-4 text-center text-xs text-gray-400">
        <NuxtLink to="/login" class="underline">← Retour à la connexion</NuxtLink>
        <NuxtLink to="/suppression-de-compte" class="underline">Supprimer mon compte</NuxtLink>
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
// Page publique (exigée par Google Play) : pas de middleware d'authentification.
// L'alias garde l'ancienne URL vivante : la modale de divulgation de l'AAB 1.0.4
// déjà signé pointe dessus, et un lien mort casserait le parcours Play.
definePageMeta({ layout: false, alias: ['/privacy-policy'] })
useHead({ title: 'Politique de confidentialité — Bonnet Rouge' })
</script>
