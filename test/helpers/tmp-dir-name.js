import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function tmpDirName() {
	return join(tmpdir(), `titanium-cli-${Math.floor(Math.random() * 1e6)}`);
}
