// Dentro de criarEnderecoObra:
export const criarEnderecoObra = async (req, res) => {
    try {
        const empresa_id = req.empresa_id;
        const { clienteId } = req.params;
        const dados = obraSchema.parse(req.body);

        // Bloqueio Multi-Tenant ativo: Impede vinculação se o cliente pertencer a terceiros
        const clienteValido = await pool.query(
            'SELECT id FROM clientes WHERE id = $1 AND empresa_id = $2',
            [clienteId, empresa_id]
        );
        if (clienteValido.rowCount === 0) {
            return res.status(403).json({ error: 'Operação negada. O cliente não pertence à sua organização.' });
        }

        const query = `INSERT INTO enderecos_obra (empresa_id, cliente_id, descricao_obra, logradouro, numero, cidade, estado) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
        const novaObra = await pool.query(query, [empresa_id, clienteId, dados.descricao_obra, dados.logradouro, dados.numero, dados.cidade, dados.estado]);
        return res.status(201).json(novaObra.rows[0]);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao registar obra.' });
    }
};