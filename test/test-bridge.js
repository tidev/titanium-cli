import Bridge from '../dist/bridge';

describe('Bridge', () => {
	it('should error request path not specified', async () => {
		try {
			await new Bridge().request();
		} catch (e) {
			expect(e).to.be.instanceOf(TypeError);
			expect(e.message).to.equal('Expected path to be a non-empty string');
			return;
		}
		throw new Error('Expected error');
	});

	it('should error request path is invalid', async () => {
		try {
			await new Bridge().request(123);
		} catch (e) {
			expect(e).to.be.instanceOf(TypeError);
			expect(e.message).to.equal('Expected path to be a non-empty string');
			return;
		}
		throw new Error('Expected error');
	});

	it('should error request data is invalid', async () => {
		try {
			await new Bridge().request('/foo', 'bar');
		} catch (e) {
			expect(e).to.be.instanceOf(TypeError);
			expect(e.message).to.equal('Expected data to be an object');
			return;
		}
		throw new Error('Expected error');
	});
});
