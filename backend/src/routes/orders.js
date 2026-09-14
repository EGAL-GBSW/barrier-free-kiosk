const { Router } = require('express');

module.exports = function orderRoutes(service) {
  const router = Router();
  router.post('/', (req, res) => {
    const order = service.create(req.body);
    res.location(`/orders/${order.id}`).status(201).json({ data: order });
  });
  router.get('/:id', (req, res) => res.json({ data: service.get(req.params.id) }));
  return router;
};
