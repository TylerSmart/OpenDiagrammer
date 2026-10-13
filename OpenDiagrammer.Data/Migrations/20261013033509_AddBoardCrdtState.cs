using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OpenDiagrammer.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddBoardCrdtState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "CrdtState",
                table: "Boards",
                type: "varbinary(max)",
                nullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "CrdtState", table: "Boards");
        }
    }
}
