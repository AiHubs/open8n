import type { Variables } from '@/databases/entities/Variables';
import { collections } from '@/Db';
import { canCreateNewVariable } from './enviromentHelpers';
import { VariablesService } from './variables.service';

export class VariablesLicenseError extends Error {}

export class EEVariablesService extends VariablesService {
	static async getCount(): Promise<number> {
		return collections.Variables.count();
	}

	static async create(variable: Omit<Variables, 'id'>): Promise<Variables> {
		if (!canCreateNewVariable(await this.getCount())) {
			throw new VariablesLicenseError('Variables limit reached');
		}
		return collections.Variables.save(variable);
	}

	static async update(id: number, variable: Omit<Variables, 'id'>): Promise<Variables> {
		await collections.Variables.update(id, variable);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return (await this.get(id))!;
	}
}
