module.exports = function (Handlebars) {
  // Handlebars to automatically thanks external contributor in changelog.md
  Handlebars.registerHelper('externalContributor', function (value) {
      const mainContributor = [ 
        'DELMAS Nicolas',
        'Nicolas D',
        'Nicolas DELMAS'
      ];

      if (mainContributor.includes(value)) {
          return false;
      }

      return true;
  })
}