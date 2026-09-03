<template>
  <div class="min-h-screen bg-gray-50 px-6 py-12 dark:bg-gray-900">
    <main class="mx-auto max-w-2xl">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Politique de confidentialité — Bonnet Rouge</h1>
      <p class="mt-1 text-sm text-gray-400">Dernière mise à jour : 3 septembre 2026</p>

      <div class="mt-8 space-y-6 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
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
              <strong>Localisation</strong> : la position GPS de l'appareil est relevée au moment de
              l'enregistrement d'une visite, afin de valider la présence sur le point de vente (géorepérage).
              L'Application ne suit pas la position en continu ni en arrière-plan.
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
        </section>

        <section>
          <h2 class="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Permissions de l'appareil</h2>
          <ul class="list-disc space-y-2 pl-5">
            <li><strong>Localisation</strong> : validation de la présence en point de vente lors d'une visite.</li>
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
            Pour toute question relative à cette politique ou à vos données :
            <a href="mailto:jeanluc@bigfiveabidjan.com" class="text-fc-red underline">jeanluc@bigfiveabidjan.com</a>
          </p>
        </section>
      </div>

      <p class="mt-10 text-center text-xs text-gray-400">
        <NuxtLink to="/login" class="underline">← Retour à la connexion</NuxtLink>
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
// Page publique (exigée par Google Play) : pas de middleware d'authentification.
definePageMeta({ layout: false })
useHead({ title: 'Politique de confidentialité — Bonnet Rouge' })
</script>
