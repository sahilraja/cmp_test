import { tags } from "./tag_model";

//  get list of tags
export async function tag_list(search: string) {
    try {
      let success = await tags.find({ tag: new RegExp(search, "i"), is_active: true });
      return { status: true, data: success }
    } catch (err) {
      console.error(err);
      throw err;
    }
  }