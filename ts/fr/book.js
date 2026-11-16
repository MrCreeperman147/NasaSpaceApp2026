/* ts/fr/book.js : le texte du livre en français (S#2-02), tiré de textefr.docx.
   Une entrée par page de js/book.js, sous son « id » :
     m1, m2…  titre de chaque moment (en-tête, Menu, PDF) : facultatif ;
     t1, t2…  texte de chaque bloc, dans l'ordre des blocs de la page
              (t1 : texte « a », page gauche ; t2 : texte « b », page droite).
   \n force un retour à la ligne ; le reste se coupe tout seul dans la boîte.
   Les mêmes entrées doivent exister dans ts/en/book.js (contrôlé au chargement). */
Demo.lang.book('fr', {
  cover: { m1: 'Couverture', t1: 'Les deux rovers jumeaux' },

  dp01: {
    m1: 'Blueprints',
    t1: 'Voici mon grand frère Spirit et ma grande sœur Opportunity, que l’on surnomme Oppy ! Ils ont été construits sur Terre par des scientifiques avant de débuter un long voyage sur la planète Mars.',
    t2: 'On leur a donné une mission, trouvé les traces de l\'eau qui coulait sur Mars il y a fort longtemps. En analysant les sols, la poussière et les rochers, ils voulaient comprendre comment Mars s’est formée. Spirit et Oppy aidaient aussi leurs amis les satellites en allant vérifier au sol ce qu’ils voyaient de tout là-haut.'
  },
  dp02: {
    m1: 'Sur Terre donc sur Mars ?',
    t1: 'Mais pourquoi chercher de l’eau, si loin de notre planète ? Chez nous, l’eau est la maison d’énormément d’espèces, du microbe invisible à l’œil nu jusqu’à la baleine bleue, la plus grande créature qui ait jamais existé sur Terre !',
    t2: 'Tous les êtres vivants ont besoin d’eau pour vivre. Toi aussi d’ailleurs, bien plus de la moitié de ton corps est composée d’eau ! Pas d’eau, pas de vie !'
  },
  dp03: {
    m1: 'Partout pareil ?',
    t1: 'Si l’eau est synonyme de vie sur Terre, est-ce vrai ailleurs dans l’Univers ?',
    t2: 'C’est aussi pour répondre à ces questions que mes aînés Spirit et Oppy sont partis sur Mars.'
  },
  dp04: {
    m1: 'Les rovers : MER',
    t1: 'Pour leur mission, on les a équipés d’une multitude de capteurs, des caméras pour les yeux, un petit bras-robot pour comprendre la composition des rochers, et des aimants pour attraper la poussière martienne.',
    t2: 'Spirit et Oppy étaient de vrais jumeaux. Tous les deux mesuraient 1 mètre 50 de haut, presque aussi grands qu’un humain adulte ! Ça a permis aux scientifiques sur Terre de voir Mars comme s’ils y étaient.'
  },
  dp05: {
    m1: 'Le grand départ',
    t1: 'Spirit et Oppy sont partis en 2003. Spirit le 10 juin, et Oppy le 8 juillet, soit à juste un mois d’écart.',
    t2: 'Leur voyage vers Mars a duré environ 7 mois, ils sont arrivés en 2004. Les jumeaux ont tous les deux passés leur Nouvel An dans l’espace !'
  },
  dp06: {
    m1: 'Atterrissage',
    t1: 'À la fin de ce long périple, Spirit et Oppy sont arrivés sur Mars à un mois d’intervalle. Ils se sont séparés pour explorer une plus grande partie de la planète. Spirit a atterri dans un cratère appelé Gusev.',
    t2: 'Tandis qu’Oppy, lui, a atterri au cœur d’un cratère dans une plaine appelée Meridiani Planum.'
  },
  dp07: {
    m1: 'Début de l’exploration',
    t1: 'À l’origine, Spirit et Oppy devaient seulement parcourir Mars pendant 90 jours martiens. On appelle une journée sur Mars « un sol ».',
    t2: 'Au final, ils ont continué à travailler pendant des années !'
  },
  dp08: {
    m1: 'Spirit',
    t1: 'Spirit avançait un peu de travers, il trainait souvent l’une de ses roues. Un jour, en allant analyser les roches, cette même roue s’est abîmée. Malgré ça, en trainant sa roue, il a découvert de la silice cachée sous la poussière. Il s’agit d’un minéral qu’il y a dans le sable et le verre. Et sur Mars, c’est la preuve que de l’eau bouillonnait autrefois !',
    t2: 'Ce qu’il adorait faire, c’est de regarder vers le ciel. Il avait vraiment la tête dans les étoiles. Un jour, il a même vu la Terre depuis Mars !'
  },
  dp09: {
    m1: 'Data collecting',
    t1: 'Avec leurs caméras, bras-robot et capteurs en tout genre, Spirit et Oppy sillonnaient Mars à la recherche de toujours plus de cailloux et poussières à analyser.',
    t2: 'Les informations qu’ils enregistraient étaient envoyées à leurs amis les satellites, qui tournaient autour de Mars. Ensuite, ces satellites transmettaient les informations aux scientifiques sur Terre. Même en voyageant à la vitesse de la lumière, les messages mettaient plusieurs minutes à traverser l’espace.'
  },
  dp10: {
    m1: 'L’endormissement de Spirit',
    t1: 'Sur Mars, la météo est souvent capricieuse. Il y a de grandes tempêtes de poussière ! Un jour, Spirit est resté bloqué dans le sable et s’est retrouvé enseveli.',
    t2: 'Pour rester éveillé, Spirit avait besoin du soleil : les panneaux solaires sur son dos transforment la lumière en énergie. Quand l’hiver martien est arrivé, il était bien fatigué. Il s’est endormi sous les étoiles en 2010.'
  },

  dp11: {
    m1: 'Oppy survit seul',
    t1: 'Oppy a continué sa mission, toute seule. Au début, elle devait parcourir 600 mètres. Au final, elle en a parcouru plus de 45 000 !',
    t2: 'C’est comme courir un marathon au lieu de courir 3 tours de piste d’athlétisme.'
  },
  dp12: {
    m1: 'Les accomplissements',
    t1: 'Avec le travail de ma grande sœur et de mon grand frère, les scientifiques ont fait des découvertes très intéressantes. Il y a très longtemps, Mars était chaude et humide. Dans un cratère, Oppy a trouvé des roches en forme de myrtilles, des pierres qui ne se forment que dans l’eau. Quand cette eau s’est évaporée, elle a laissé du sel dans les roches. C’est la preuve que ces cratères étaient remplis d’eau salée !',
    t2: 'Grâce à Spirit et à ses explorations, on a trouvé des sources chaudes bouillonnantes, mais aussi des volcans. Sur Terre, les microbes adorent vivre dans ces endroits-là. Avec ces découvertes, on en sait plus sur Mars, et on espère peut-être y trouver un jour d’anciennes traces de vie !'
  },
  dp13: {
    m1: 'Curiosity',
    t1: 'D’ailleurs, moi c’est Curiosity ! Je suis arrivé sur Mars en 2012, en atterrissant dans le cratère Gale. J’ai repris le travail de mes aînés : chercher les traces de l’eau, et peut-être un jour, celles de la vie !',
    t2: 'J’ai fêté mon premier anniversaire sur Mars le 6 août 2013. Spirit dormait déjà, et Oppy roulait quelque part de l’autre côté de la planète. Alors les scientifiques m’ont appris à chanter « Joyeux Anniversaire », et je me le suis chanté tout seul comme un grand !'
  },
  dp14: {
    m1: 'Sommeil d’Oppy',
    t1: 'En 2018, une gigantesque tempête de poussière a recouvert toute la planète, la plus grande jamais vue sur Mars ! La poussière a caché le soleil, et les panneaux solaires d’Oppy n’ont plus reçu de lumière. Sa batterie s’est vidée, petit à petit.',
    t2: 'L’un des derniers messages qu’elle a envoyés vers la Terre a été « Ma batterie est presque vide et il fait de plus en plus sombre ». Oppy s’est endormie en 2018, après presque 15 ans à explorer Mars.'
  },
  dp15: {
    m1: 'The End',
    t1: 'Spirit et Oppy continuent de dormir sur Mars. Mais quelque part, ils explorent encore l’espace : pour remercier nos deux jumeaux, des scientifiques ont renommé deux astéroïdes en leur honneur !',
    t2: 'L’astéroïde 37452 s’appelle désormais Spirit. Quant à l’astéroïde 39382, il porte fièrement le nom d’Opportunity, celui de ma grande sœur Oppy. Quelque part, entre Mars et Jupiter, une partie d’eux voyage encore, ensemble et pour toujours.'
  },

  credits: {
    m1: 'Crédits',
    t1: 'Crédits',
    t2: 'Ce livre est une création de Noémie Rodrigues Moreira, Lucile Rodrigues Moreira Wexsteen, Bright Ogbeiwei et Nathan Lunel.' + '\n' +
        'Dessins, illustrations et vision artistique : Noémie Rodrigues Moreira et Lucile Rodrigues Moreira Wexsteen\nDéveloppement technique : Bright Ogbeiwei\nTexte et audios : Nathan Lunel' + '\n' +
        'Sources et remerciements : l\'Université de Sherbrooke, pour son soutien tout au long du projet, et la NASA, dont les archives et les publications ont nourri ce livre.' + '\n' +
        'Photographies de Mars : NASA / JPL-Caltech, issues des archives publiques de la NASA.' + '\n' +
        'Et un merci tout spécial à Persévérance, Curiosity, Opportunity et Spirit, pour les photos, pour les découvertes, et pour toutes les émotions qu\'ils nous font vivre ici sur Terre.'
  }
});
