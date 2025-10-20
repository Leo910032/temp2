const defaultParams = {
    // Prix des cartes (basé sur le dossier prévisionnel)
    prixPVC: 29.99,
    prixBois: 37.99,
    prixMetal: 45.99,

    // Volume de ventes (nombre de cartes par an) - Données exactes du PDF
    ventesAnnee1: 800,
    ventesAnnee2: 3000,
    ventesAnnee3: 6000,

    // Répartition des ventes (en %) - Mix produits selon prévisionnel
    partPVC: 50,
    partBois: 22,
    partMetal: 28,

    // SaaS - Prix par tier (en €/mois) - Calibré sur ARPU ~27-30€
    prixBase: 0,
    prixPlus: 16.99,
    prixPremium: 25.99,
    prixBusiness: 39.99,
    prixEnterprise: 60,

    // SaaS - Répartition des abonnés par tier (en %) - Basé sur données Année 3
    partBase: 0,
    partPlus: 48,
    partPremium: 14,
    partBusiness: 21,
    partEnterprise: 17,

    // Taux de conversion (%) - Données exactes du dossier prévisionnel
    tauxConversionAnnee1: 27.5,
    tauxConversionAnnee2: 30,
    tauxConversionAnnee3: 46,

    // Taux d'activation (%) - Données exactes du dossier prévisionnel
    tauxActivationAnnee1: 75,
    tauxActivationAnnee2: 95,
    tauxActivationAnnee3: 85,

    // Coûts totaux (COGS + OPEX) - Données exactes du compte de résultat
    coutsOperationnelsAnnee1: 16740,  // 5,040 COGS + 11,700 OPEX
    coutsOperationnelsAnnee2: 82300,  // 18,900 COGS + 63,400 OPEX
    coutsOperationnelsAnnee3: 504300, // 37,800 COGS + 466,500 OPEX
  };
