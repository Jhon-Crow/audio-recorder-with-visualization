describe('Preview Alignment Guides', () => {
  function selectHiddenOption(selector, value) {
    cy.get(selector).then(($select) => {
      $select.val(value);
      $select[0].dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function setRangeValue(selector, value) {
    cy.get(selector).then(($range) => {
      $range.val(value);
      $range[0].dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/examples/index.html');
    cy.waitForVisualization();
  });

  it('shows a preview-only mounting-area outline for portrait output', () => {
    selectHiddenOption('#aspectRatio', '9:16');

    cy.get('#previewOverlay')
      .should('exist')
      .and('have.css', 'pointer-events', 'none');
    cy.get('#previewOverlay').should('have.css', 'border-top-width', '1px');
    cy.get('#previewOverlay .alignment-grid')
      .should('exist')
      .and('have.css', 'opacity', '0');
    cy.get('#visualizer').should('have.prop', 'width', 608);
    cy.get('#visualizer').should('have.prop', 'height', 1080);
  });

  it('reveals grid and smart guides only while dragging visualization offsets', () => {
    cy.get('#previewOverlay').should('not.have.class', 'is-dragging');
    cy.get('#previewOverlay .alignment-grid').should('have.css', 'opacity', '0');
    cy.get('[data-guide="vertical-center"]').should('have.class', 'is-visible');
    cy.get('[data-guide="horizontal-center"]').should('have.class', 'is-visible');
    cy.get('[data-guide="vertical-center"]').should('not.be.visible');
    cy.get('[data-guide="horizontal-center"]').should('not.be.visible');

    cy.get('#visualizer').trigger('mousedown', { clientX: 300, clientY: 260 });
    cy.get('#previewOverlay').should('have.class', 'is-dragging');
    cy.get('#previewOverlay .alignment-grid').should('have.css', 'opacity', '0.22');
    cy.get('[data-guide="vertical-center"]').should('have.css', 'display', 'block');
    cy.get('[data-guide="horizontal-center"]').should('have.css', 'display', 'block');

    setRangeValue('#offsetX', 70);
    setRangeValue('#offsetY', 80);
    cy.get('[data-guide="vertical-center"]').should('not.have.class', 'is-visible');
    cy.get('[data-guide="horizontal-center"]').should('not.have.class', 'is-visible');
    cy.get('[data-guide="vertical-grid"]').should('not.have.class', 'is-visible');

    selectHiddenOption('#aspectRatio', '9:16');

    setRangeValue('#offsetX', 152);
    cy.get('[data-guide="vertical-grid"]')
      .should('have.class', 'is-visible')
      .and('have.attr', 'style')
      .and('include', 'left: 75%');

    setRangeValue('#offsetY', -135);
    cy.get('[data-guide="horizontal-grid"]')
      .should('have.class', 'is-visible')
      .and('have.attr', 'style')
      .and('include', 'top: 37.5%');

    cy.get('#visualizer').trigger('mouseup');
    cy.get('#previewOverlay').should('not.have.class', 'is-dragging');
    cy.get('#previewOverlay .alignment-grid').should('have.css', 'opacity', '0');
    cy.get('[data-guide="vertical-grid"]').should('have.css', 'display', 'none');
    cy.get('[data-guide="horizontal-grid"]').should('have.css', 'display', 'none');
  });

  it('applies visualization scale slider changes to the active visualizer', () => {
    setRangeValue('#visualizationScale', 150);

    cy.get('#scaleValue').should('contain.text', '150%');
    cy.getVisualizerOptions().then((options) => {
      expect(options.scale).to.equal(1.5);
    });
    cy.window().then((win) => {
      const saved = JSON.parse(win.localStorage.getItem('audio-recorder-settings'));
      expect(saved.scale).to.equal(150);
    });
  });
});
