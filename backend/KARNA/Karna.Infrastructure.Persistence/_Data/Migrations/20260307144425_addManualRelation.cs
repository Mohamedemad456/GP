using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Karna.Infrastructure.Persistence._Data.Migrations
{
    /// <inheritdoc />
    public partial class addManualRelation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
			// Manual FK: Users.IdentityUserId → AspNetUsers.Id
			migrationBuilder.AddForeignKey(
				name: "FK_Users_AspNetUsers_IdentityUserId",
				table: "Users",
				column: "IdentityUserId",
				principalTable: "AspNetUsers",
				principalColumn: "Id",
				onDelete: ReferentialAction.Restrict);

			// Manual FK: RefreshTokens.IdentityUserId → AspNetUsers.Id
			migrationBuilder.AddForeignKey(
				name: "FK_RefreshTokens_AspNetUsers_IdentityUserId",
				table: "RefreshTokens",
				column: "IdentityUserId",
				principalTable: "AspNetUsers",
				principalColumn: "Id",
				onDelete: ReferentialAction.Restrict);
		}

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
			migrationBuilder.DropForeignKey(
				name: "FK_RefreshTokens_AspNetUsers_IdentityUserId",
				table: "RefreshTokens");

			migrationBuilder.DropForeignKey(
				name: "FK_Users_AspNetUsers_IdentityUserId",
				table: "Users");
		}
    }
}
